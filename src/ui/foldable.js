/**
 * Makes sections foldable by toggling a CSS class on click and supports expanding/collapsing all sections.
 * Adds global methods `collapseAllSections()` and `expandAllSections()` to the window object.
 * @module ui/foldable
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {
    init
};

let clClass;

/**
 * Opens the foldable section: animates, updates ARIA attributes, and enables tab navigation for content.
 * @param {HTMLElement} btn        The toggle button element associated with the foldable section.
 * @param {HTMLElement} header     The header element of the foldable section.
 * @param {HTMLElement} container  The foldable container element to be expanded.
 */
function openSection(btn, header, container) {
    btn.setAttribute('aria-expanded', 'true');
    header.classList.remove('is-collapsed');
    container.setAttribute('aria-hidden', 'false');
    // Set explicit height, then on transition end set to auto for resize-robustness
    container.style.height = `${container.scrollHeight}px`;
    container.classList.remove(clClass);

    // When transition ends, set height to auto
    container.addEventListener('transitionend', function handler(e) {
        if (e.propertyName === 'height') {
            container.style.height = 'auto';
            container.removeEventListener('transitionend', handler);
        }
    });
}

/**
 * Closes the foldable section: animates, updates ARIA attributes, and disables tab navigation for content.
 * @param {HTMLElement} btn        The toggle button element associated with the foldable section.
 * @param {HTMLElement} header     The header element of the foldable section.
 * @param {HTMLElement} container  The foldable container element to be collapsed.
 */
function closeSection(btn, header, container) {
    btn.setAttribute('aria-expanded', 'false');
    header.classList.add('is-collapsed');
    container.setAttribute('aria-hidden', 'true');
    // From current height to 0
    container.style.height = `${container.scrollHeight}px`;
    // Force reflow
    container.offsetHeight; // eslint-disable-line no-unused-expressions
    container.style.height = '0px';
    container.classList.add(clClass);
}

/**
 * Sets or removes tabindex="-1" for all focusable elements inside a section.
 * @param {HTMLElement} container  The parent element whose focusable descendants will be updated.
 * @param {number|null} value      Pass -1 to disable tab navigation (set tabindex="-1"), or null to restore/remove the tabindex attribute.
 */
function setTabIndexes(container, value) {
    // Matches a, button, input, textarea, select, [tabindex]
    container.querySelectorAll('a, button, input, textarea, select, [tabindex]').forEach(el => {
        if (value === -1) el.setAttribute('tabindex', '-1');
        else el.removeAttribute('tabindex');
    });
}

/**
 * Initializes and sets up foldables.
 * - add click handler
 * - set up headers
 * - set up containers.
 * @memberof module:ui/foldable
 * @param {Object} [options]                    Options for foldable behavior.
 * @param {string} [options.headerSelector]     Selector for foldable section headers.
 * @param {string} [options.containerSelector]  Selector for content containers.
 * @param {string} [options.buttonSelector]     Selector for the folding button.
 * @param {string} [options.closedClass]        CSS class used for collapsed state.
 */
export function init({
    headerSelector = '.foldable-heading',
    buttonSelector = '.foldable-toggle',
    containerSelector = '.foldable-container',
    closedClass = 'is-folded'
} = {}) {

    clClass = closedClass;

    // Toggle folding on button click
    document.addEventListener('click', e => {

        const btn = e.target.closest(buttonSelector);
        if (!btn) return;

        const header = btn.closest(headerSelector);
        if (!header) return;

        // Find associated container
        let container = header.nextElementSibling;
        while (container && !container.matches(containerSelector)) {
            container = container.nextElementSibling;
        }
        if (!container) return;

        const isClosed = container.getAttribute('aria-hidden') === 'true';

        if (isClosed) openSection(btn, header, container);
        else closeSection(btn, header, container);

    });

    // Initialize all sections according to their default state
    document.querySelectorAll(headerSelector).forEach(header => {

        const btn = header.querySelector(buttonSelector);
        let container = header.nextElementSibling;

        while (container && !container.matches(containerSelector)) {
            container = container.nextElementSibling;
        }

        if (!container || !btn) return;

        // Set ARIA attributes according to initial state
        const isClosed = document.documentElement.classList.contains('is-folded');

        if (isClosed) {
            header.classList.add('is-collapsed');
            btn.setAttribute('aria-expanded', 'false');
            container.setAttribute('aria-hidden', 'true');
            setTabIndexes(container, -1);
        } else {
            header.classList.remove('is-collapsed');
            btn.setAttribute('aria-expanded', 'true');
            container.setAttribute('aria-hidden', 'false');
            setTabIndexes(container, null);
        }

    });

    // Expand/collapse all functions
    window.collapseAllSections = function() {
        document.querySelectorAll(headerSelector).forEach(header => {
            const btn = header.querySelector(buttonSelector);
            let container = header.nextElementSibling;
            while (container && !container.matches(containerSelector)) {
                container = container.nextElementSibling;
            }
            if (!container || !btn) return;
            closeSection(btn, header, container);
        });
    };

    window.expandAllSections = function() {
        document.querySelectorAll(headerSelector).forEach(header => {
            const btn = header.querySelector(buttonSelector);
            let container = header.nextElementSibling;
            while (container && !container.matches(containerSelector)) {
                container = container.nextElementSibling;
            }
            if (!container || !btn) return;
            openSection(btn, header, container);
        });
    };

    document.getElementById('collapse-settings').addEventListener('change', () => {
        if (window.localStorage) window.localStorage.setItem('collapseOnLoad', event.target.checked ? 'true' : 'false');
    });

    const isFolded = document.documentElement.classList.contains('is-folded');
    document.getElementById('collapse-settings').checked = isFolded;
}
