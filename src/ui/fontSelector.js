/**
 * Handles font switching via the font-select select element.
 * @module ui/fontSelector
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default { init, setFont };

/**
 * Initializes the font selector dropdown in the settings popup.
 * Loads the saved font preference from localStorage or uses the default from the template.
 * Updates the document's data-font attribute and triggers popup layout update on change.
 * @param {module:ui/Popup} popup  The settings popup instance (for layout recalculation).
 */
function init(popup) {
    const select = document.getElementById('font-select');
    if (!select) return;

    // Load saved preference or use predefined font from template
    const savedFont = localStorage.getItem('fontFamily') || document.documentElement.dataset.font || 'ubuntu';
    select.value = savedFont;
    setFont(savedFont);

    // Add change listener
    select.addEventListener('change', event => {
        const font = event.target.value;
        setFont(font);
        localStorage.setItem('fontFamily', font);
        popup.layout();
    });
}

/**
 * Sets the font on the document root by updating the data-font attribute.
 * @param {string} font  The font key to set (e.g. 'ubuntu', 'fira', 'recursive').
 */
function setFont(font) {
    const doc = document.documentElement;
    doc.dataset.font = font;
}
