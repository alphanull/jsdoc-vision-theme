/**
 * Initializes toggling of private API visibility in the documentation.
 * Syncs the "Show private members" setting with localStorage and toggles the .no-privates class to hide or show private members in the UI.
 * Should be called on page load.
 * - Reads the "showPrivates" value from localStorage (if available).
 * - Updates the state of the #private-settings checkbox and the document class.
 * - Wires the checkbox to toggle private visibility and persist the setting.
 * @module theme/privates
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {
    init
};

/**
 * Initializes and sets up the private switch.
 */
export function init() {

    const privateSetting = document.getElementById('private-settings');

    if (!privateSetting) return;

    if (window.localStorage) {
        const showPrivates = window.localStorage.getItem('showPrivates');
        if (showPrivates === 'false') {
            document.documentElement.classList.add('no-privates');
            privateSetting.checked = false;
        }
    }

    privateSetting.addEventListener('change', () => {
        document.documentElement.classList.toggle('no-privates', !event.target.checked);
        if (window.localStorage) window.localStorage.setItem('showPrivates', event.target.checked ? 'true' : 'false');
    });
}
