/**
 * Provides dual sticky behavior for a sidebar element:
 * - If the sidebar fits inside the viewport including offsets, it keeps the default CSS `position: sticky; top: <topOffset>px` that you define in your stylesheet.
 * - If the sidebar is taller than the viewport, it dynamically sets a **negative** `top` value so that the element scrolls until its bottom edge is exactly `bottomOffset` pixels above the viewport bottom and then “sticks” there.
 * @module nav/dualStickyNav
 * @author Frank Kudermann @ alphanull
 * @version 1.0.0
 * @license  MIT
 */
export default {
    init
};

/**
 * Sets up the navigation by creating the probe and setting up the ResizeObserver.
 * @param {HTMLElement} el                 Sidebar element that should become dual‑sticky.
 * @param {number}      [topOffset=16]     Pixels the sidebar should keep from the viewport top when it fits.
 * @param {number}      [bottomOffset=16]  Pixels the sidebar should keep from the viewport bottom when it is taller than the viewport.
 */
export function init(el, topOffset = 16, bottomOffset = 16) {

    if (!el) return;

    // Invisible probe element whose height always matches the current viewport height
    const vpProbe = document.createElement('div');
    vpProbe.style.cssText = `
        position:fixed;
        inset:0 auto auto 0;
        width:0;
        height:100vh;
        height:100dvh; /* tracks viewport height incl. dynamic browser UI */
        pointer-events:none;
        visibility:hidden;
        z-index:-1;
      `;
    document.body.appendChild(vpProbe);

    /**
     * Recalculates and applies the appropriate `top` value.
     * Clears the inline style when the sidebar fits, or sets a negative value
     * so the bottom edge sticks `bottomOffset` px above the viewport bottom.
     */
    const updateTop = () => {
        const viewportHeight = vpProbe.offsetHeight, // Current viewport height
              sidebarHeight = el.offsetHeight, // Sidebar height
              fitsViewport = sidebarHeight + topOffset + bottomOffset <= viewportHeight;

        if (fitsViewport) {
            // Sidebar fits → rely solely on CSS sticky‑top
            el.style.top = '';
        } else {
            // Sidebar taller → use negative top so bottom locks at bottomOffset
            el.style.top = `${viewportHeight - bottomOffset - sidebarHeight}px`;
        }
    };

    // One ResizeObserver covers both content size and viewport height changes
    const ro = new ResizeObserver(updateTop);
    ro.observe(el); // React to content growth/shrinkage
    ro.observe(vpProbe); // React to viewport resizes via the probe

    updateTop(); // Initial calculation
}
