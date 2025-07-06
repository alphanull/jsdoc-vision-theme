/**
 * Initializes and manages font size settings for the documentation.
 * Handles slider UI state and persistent storage of user choice.
 * - Reads user's last font size preference from localStorage.
 * - Sets up change handlers for font size slider.
 * - Updates CSS custom property --font-size-base.
 * @module ui/uiScale
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {
    init
};

let fontSizeSetting;

/**
 * Sets the font size and updates the CSS custom property.
 * @param {number}  size            Font size in pixels.
 * @param {boolean} [persist=true]  If true, persist setting in localStorage.
 */
function setFontSize(size, persist = true) {

    const minSize = parseInt(fontSizeSetting.min, 10),
          maxSize = parseInt(fontSizeSetting.max, 10);

    if (size >= minSize && size <= maxSize) {
        document.documentElement.style.setProperty('--font-size-base', `${size}px`);
        fontSizeSetting.value = size;
        if (persist && window.localStorage) window.localStorage.setItem('uiScale', size.toString());
    }
}

/**
 * Initializes font size slider and synchronizes UI state with user preference.
 * Should be called once on page load.
 * @memberof module:ui/fontsize
 * @param {Object} popup  The settings popup object.
 */
export function init(popup) {

    fontSizeSetting = document.getElementById('uiscale-settings');

    // Get initial font size from CSS
    const computedStyle = getComputedStyle(document.documentElement),
          cssFontSize = computedStyle.getPropertyValue('--font-size-base'),
          cssSize = parseInt(cssFontSize, 10) || 14,
          savedSize = window.localStorage && window.localStorage.getItem('uiScale'),
          initialSize = savedSize ? parseInt(savedSize, 10) : cssSize;

    fontSizeSetting.value = initialSize;

    // Only update font size when user releases the slider (mouseup/change)
    fontSizeSetting.addEventListener('change', event => {
        const size = parseInt(event.target.value, 10);
        setFontSize(size, true);
        if (popup) popup.layout();
    });

}
