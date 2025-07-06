import { publish } from '../util/publisher.js';

/**
 * Mobile navigation overlay and gesture menu for Vision Theme.
 * Handles initialization, show/hide, drag gestures, resizing, content injection,
 * and event wiring for mobile navigation.
 * @module   nav/navMobile
 * @requires util/publisher
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {

    /**
     * Initializes the mobile menu with required DOM elements and options.
     * Sets up all handlers, click blockers, wrappers, and event listeners.
     * @param {Element|DocumentFragment} [content]                 The navigation content (optional).
     * @param {Object}                   [options]                 Additional options.
     * @param {Element}                  [options.initiator]       Element to trigger the menu (usually the hamburger button).
     * @param {Element}                  [options.closeTrigger]    Element that can close the menu (e.g. A close button).
     * @param {Element}                  [options.insertBefore]    If provided, the menu will be inserted before this element.
     * @param {boolean}                  [options.preventDefault]  Whether to prevent default navigation on links.
     */
    init(content, options = {}) {

        if (content) {
            this.content = content;
        } else {
            this.content = document.createElement('nav');
            this.content.id = 'menu-mobile';
        }

        this.options = options;

        if (options.initiator) {
            this.initiator = options.initiator;
            this.initiator.addEventListener('click', this.show.bind(this));
        }

        if (options.closeTrigger) {
            this.closeTrigger = options.closeTrigger;
        }

        this.dragLayer = this.content;

        this.clickBlocker = document.createElement('div');
        this.clickBlocker.className = 'menu-mobile-bg';

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'menu-mobile-wrapper';

        this.view = document.createElement('div');
        this.view.className = 'menu-mobile';
        this.view.setAttribute('data-lenis-prevent', '');
        this.view.appendChild(this.clickBlocker);
        this.view.appendChild(this.wrapper);

        const sty = this.content.style,
              transforms = ['webkitTransform', 'MozTransform', 'msTransform', 'OTransform', 'transform'];

        this.transform = 'transform';

        for (const i in transforms) {
            if (i in sty) {
                this.transform = transforms[i];
                break;
            }
        }

        this.onNavTouchStartHandler = this.pointerStart.bind(this);
        this.onNavTouchMoveHandler = this.pointerMove.bind(this);
        this.onNavTouchEndHandler = this.pointerEnd.bind(this);
        this.onHide = this.hide.bind(this);
        this.onNavAniEnd = this.hideEnd.bind(this);
        this.onNavResize = this.resize.bind(this);
        this.onNavClick = this.navClick.bind(this);

        this.ro = new ResizeObserver(this.onNavResize);

    },

    /**
     * Opens and displays the mobile navigation overlay.
     * Sets active classes, locks scroll, and wires relevant listeners.
     */
    show() {

        this.mobileNaviActive = true;
        this.attachContent(this.content);

        this.wrapper.addEventListener('click', this.onHide);
        this.content.addEventListener('click', this.onNavClick);
        this.content.classList.add('menu-mobile-content');
        this.view.classList.add('active');

        // window.addEventListener('resize', this.onNavResize);
        this.ro.observe(this.view);

        publish('locklayer', this.wrapper, { async: false });
        publish('menu/mobile/show');

        if (this.options.insertBefore) {
            this.options.insertBefore.parentNode.insertBefore(this.view, this.options.insertBefore);
        } else {
            document.body.appendChild(this.view);
        }

        if (this.closeTrigger) {
            this.closeTrigger.addEventListener('click', this.hide.bind(this));
        }

        this.content.addEventListener('pointerdown', this.onNavTouchStartHandler);

        setTimeout(() => { this.view.classList.add('visible'); }, 20);

    },

    /**
     * Hides the mobile navigation overlay if triggered by click, wrapper, or close element.
     * Unwires listeners and triggers hide events.
     * @param {Event|boolean} [event]  The event that triggered hiding, or true for forced hide.
     */
    hide(event) {

        if (event === true || typeof event === 'undefined' || event.target === this.wrapper || event.target === this.closeTrigger) {

            publish('menu/mobile/hide');

            this.navDragPercent = 0;
            this.wrapper.removeEventListener('click', this.onHide);
            this.content.removeEventListener('click', this.onNavClick);
            this.ro.unobserve(this.view);

            this.clickBlocker.addEventListener('transitionend', this.onNavAniEnd);
            this.pointerEnd();
            this.content.removeEventListener('pointerdown', this.onNavTouchStartHandler);

            this.view.classList.remove('visible');

        } else if (event.target.tagName !== 'A' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'INPUT') {

            event.preventDefault();

        }

    },

    /**
     * Cleanup and DOM removal after hide animation is complete.
     * Restores original parent/position, unlocks scroll, and fires navigation if needed.
     */
    hideEnd() {

        this.detachContent();

        this.mobileNaviActive = false;
        this.dragLayer.style[this.transform] = '';
        this.navDragPercent = 0;

        this.clickBlocker.removeEventListener('transitionend', this.onNavAniEnd);

        if (this.closeTrigger) {
            this.closeTrigger.removeEventListener('click', this.hide.bind(this));
        }

        this.view.classList.remove('active');
        this.content.classList.remove('menu-mobile-content');

        this.view.parentNode.removeChild(this.view);

        publish('unlocklayer', this.wrapper, { async: false });
        publish('menu/mobile/hidden');

        if (this.event) {

            // $$$ PATCH
            // location.href = this.event.srcElement.href;
            // window.location.replace(this.event.srcElement.href);
            this.event.srcElement.click();

            publish('menu/mobile/navigate', this.event);
            this.event = null;

        }

    },

    /**
     * Handles click events within the navigation overlay.
     * Publishes click events and processes link/button logic.
     * @param {Event} event  The original click event.
     */
    navClick(event) {

        publish('menu/mobile/clicked', event);

        const target = event.target.parentNode.tagName === 'A'
            ? event.target.parentNode
            : event.target;

        if (target.tagName === 'A') {

            this.event = event;

            if (this.options.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }

            this.hide(true);

        }

    },

    /**
     * Handles viewport resize events, hides the menu if above mobile breakpoint.
     * @param {ResizeObserverEntry[]} entries  Entries from the ResizeObserver.
     */
    resize(entries) {

        this.viewportWidth = entries[0] && entries[0].contentRect.width;
        if (this.viewportWidth > 1023) this.hide();

    },

    /**
     * Injects or appends content (Element, DocumentFragment, or string) into the mobile menu wrapper.
     * Saves and restores the previous parent/position if needed.
     * @param  {Element|DocumentFragment|string} content  The navigation content to attach.
     * @throws {Error}                                    If content is not a string or DOM Element.
     */
    attachContent(content) {

        if (content instanceof DocumentFragment || content instanceof Element) {

            if (content.parentNode) {

                //  save current Location
                this.savedParent = content.parentNode;
                this.savedSibling = content.nextElementSibling;
                /* this.savedStyle = content.currentStyle === undefined ? window.getComputedStyle(content, null).display : content.currentStyle.display;

                if (this.savedStyle === "none") {
                    switch (content.tagName) { // check for right display using tag names, when node was hidden ($$$$ VERY incomplete)
                        case "SPAN":
                            content.style.display = "inline";
                            break;
                        default:
                            content.style.display = "block";
                            break;
                    }
                } */

            }

            this.wrapper.appendChild(content);

        } else if (typeof content === 'string' || content instanceof String) {

            this.wrapper.innerHTML = content;

        } else {

            throw new Error('Overlay: No valid content type, must be a string or DOM Element');

        }

    },

    /**
     * If an existing content parent position was saved before, puts the element back where it was; otherwise just empties the content area.
     * @private
     */
    detachContent() {

        if (this.savedParent) {

            /* if (this.savedStyle === "none") {
                this.content.style.display = "none";
            } */

            if (this.savedSibling) {
                this.savedParent.insertBefore(this.content, this.savedSibling);
                this.savedSibling = null;
            } else {
                this.savedParent.appendChild(this.content);
            }

            this.savedParent = null;

        } else if (this.wrapper && this.wrapper.firstChild && this.content) {

            this.wrapper.removeChild(this.content);

        }

    },

    /**
     * Handles the start of a drag/touch gesture on the mobile navigation.
     * Sets up pointermove and pointerup event handlers.
     * @param {PointerEvent|TouchEvent} event  The gesture event.
     */
    pointerStart(event) {

        this.dragLayer.classList.add('dragging');
        this.isDragging = true;
        this.lastX = event.touches ? event.touches[0].pageX : event.pageX; // get current Y touch value;

        this.content.addEventListener('pointermove', this.onNavTouchMoveHandler);
        this.content.addEventListener('pointerup', this.onNavTouchEndHandler);

    },

    /**
     * Handles drag/touch movement on the navigation, calculates drag percentage,
     * and triggers hide/transform if threshold is exceeded.
     * Uses requestAnimationFrame for performance.
     * @param   {PointerEvent|TouchEvent} event  The gesture event.
     * @returns {boolean|void}                   False if an animation is already pending.
     */
    pointerMove(event) {

        if (typeof this.requestID !== 'undefined' && this.requestID !== null) { return false; }

        this.requestID = window.requestAnimationFrame(() => {

            this.requestID = null;

            const currentX = event.touches ? event.touches[0].pageX : event.pageX; // get current X touch values
            let delta;

            // reset last value
            if (this.lastX < 0) {
                this.lastX = currentX;
                delta = 0;
            } else {
                delta = currentX - this.lastX;
            }

            this.navDragPercent = delta / this.viewportWidth * 200;

            if (this.navDragPercent > 40 && this.dragLayer === this.content) {

                this.isDragging = false;
                this.hide();

            } else if (this.navDragPercent > 1 && this.dragLayer === this.content) {

                window.requestAnimationFrame(() => {
                    this.dragLayer.style[this.transform] = `translateX(${this.navDragPercent}%) translateY(0) translateZ(0)`;
                });

            }

        });

    },

    /**
     * Handles end of drag/touch gesture, resets drag state and unwires handlers.
     * @param {PointerEvent|TouchEvent} [event]  The gesture event.
     * @param {boolean}                 [reset]  Whether to reset drag transforms (default true).
     */
    pointerEnd(event, reset) {

        if (typeof this.requestID !== 'undefined' && this.requestID !== null) {
            cancelAnimationFrame(this.requestID);
            this.requestID = null;
        }

        this.dragLayer.classList.remove('dragging');
        this.isDragging = false;

        if (reset !== false) {
            this.dragLayer.style[this.transform] = '';
            this.navDragPercent = 0;
        }

        this.content.removeEventListener('pointermove', this.onNavTouchMoveHandler);
        this.content.removeEventListener('pointerup', this.onNavTouchEndHandler);

    }
};
