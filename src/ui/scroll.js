/**
 * Smooth scrolling functionality for the VisionTheme JSDoc template.
 * This module provides smooth scrolling capabilities using the {@link https://lenis.darkroom.engineering/|Lenis} library for enhanced
 * user experience when navigating through documentation. It handles internal anchor links
 * and provides smooth scrolling to target elements with proper margin calculations.
 * The module automatically:
 * - Initializes Lenis smooth scrolling with RAF (RequestAnimationFrame) optimization
 * - Intercepts clicks on internal anchor links (href starting with #)
 * - Provides smooth scrolling to target elements with scroll margin support
 * - Updates browser history without page reloads
 * - Handles various modifier keys to prevent interference with user intent.
 * @module   ui/scroll
 * @requires lenis
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 * @see      https://github.com/alphanull/jsdoc-theme-vision
 */

import Lenis from 'lenis';

/**
 * Default export object containing the module's public API.
 * Provides access to the initialization function for setting up smooth scrolling functionality.
 * @type     {Object}
 * @property {Function} init  - The main initialization function for smooth scrolling.
 */
export default {
    init
};

/**
 * Lenis smooth scrolling instance configured for optimal performance.
 * Uses RequestAnimationFrame for smooth animations and handles all scrolling operations.
 * @type {Lenis}
 * @see https://lenis.darkroom.engineering/
 */
export const lenis = new Lenis({ autoRaf: true });

/**
 * Scrolls to a target element with proper margin calculation using Lenis.
 *
 * This function handles smooth scrolling to a target element while respecting
 * CSS scroll-margin-top values. It's particularly useful for fixed headers
 * where content might be hidden behind the header.
 * @param {string|Element} target         The target element to scroll to. Can be a CSS selector string or DOM element.
 * @param {Object}         [opts={}]      Additional options for the scroll operation.
 * @param {number}         [opts.offset]  Additional offset to apply to the scroll position.
 */
function scrollTo(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const scrollMarginTop = parseInt(style.scrollMarginTop, 10) || 0;
    lenis.scrollTo(el, { ...opts, offset: -(opts.offset || 0) - scrollMarginTop });
}

/**
 * Initializes smooth scrolling functionality for internal anchor links.
 * This function sets up event listeners to intercept clicks on internal anchor links
 * and provides smooth scrolling to the target elements. It includes various safety
 * checks to ensure proper behavior and user experience.
 * @memberof module:ui/scroll
 * @param {Element} [rootEle=document]  The root element to attach event listeners to. Defaults to document for global coverage.
 */
export function init(rootEle = document) {
    rootEle.addEventListener('click', e => {
        const link = e.target.closest('a[href*="#"]');

        if (link && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            const href = link.getAttribute('href');

            // Check if it's a same-page link by comparing the resolved URLs
            const currentUrl = window.location.href.split('#')[0]; // Remove hash from current URL
            const linkUrl = link.href.split('#')[0]; // Remove hash from link URL
            const isSamePage = currentUrl === linkUrl;

            if (isSamePage) {
                const hashIndex = href.indexOf('#');

                if (hashIndex !== -1 && hashIndex < href.length - 1) {
                    const id = href.slice(hashIndex + 1);
                    const target = document.getElementById(id);

                    if (target) {
                        e.preventDefault();
                        scrollTo(target);
                        history.pushState(null, '', `#${id}`);
                    }
                }
            }
        }
    });
}
