/**
 * Initializes and manages dark mode/light mode switching for the documentation.
 * Handles button UI state, system preference, and persistent storage of user choice.
 * - Reads user's last theme preference from localStorage.
 * - Sets up click handlers for theme switch buttons.
 * - Listens for changes to system color scheme (prefers-color-scheme).
 * - Updates <html> classes ("is-dark-mode"/"is-light") and button highlight.
 * @module ui/darkmode
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {
    init
};

const cl = document.documentElement.classList,
      darkModePreference = window.matchMedia('(prefers-color-scheme: dark)');

let darkMode, darkModeSetting;

/**
 * Enables the dark theme. Updates control states, `<html>` classes, and optionally persists the setting.
 * @param {boolean} [persist=true]  If true, persist setting in localStorage.
 */
function themeDarkEnabled(persist = true) {
    darkMode = 'dark';
    cl.add('is-dark-mode');
    darkModeSetting.checked = true;

    if (persist && window.localStorage) window.localStorage.setItem('darkmode', 'dark');
}

/**
 * Enables the light theme. Updates control states, `<html>` classes, and optionally persists the setting.
 * @param {boolean} [persist=true]  If true, persist setting in localStorage.
 */
function themeLightEnabled(persist = true) {
    darkMode = 'light';
    cl.remove('is-dark-mode');
    darkModeSetting.checked = false;

    if (persist && window.localStorage) window.localStorage.setItem('darkmode', 'light');
}

/**
 * Initializes dark mode switching and synchronizes UI state with system and user preference.
 * Should be called once on page load.
 */
export function init() {

    darkModeSetting = document.getElementById('darkmode-settings');
    darkModeSetting.checked = darkMode === 'dark';
    darkModeSetting.addEventListener('change', event => {
        if (event.target.checked) themeDarkEnabled(true); else themeLightEnabled(true);
    });

    if (window.localStorage) {
        darkMode = window.localStorage.getItem('darkmode');
        if (darkMode === 'dark') themeDarkEnabled(true);
        else if (darkMode === 'light') themeLightEnabled(true);
    }

    if (!darkMode && window.matchMedia) {
        if (darkModePreference.matches) themeDarkEnabled(false); else themeLightEnabled(false);
        darkModePreference.addEventListener('change', event => {
            if (event.matches) themeDarkEnabled(false); else themeLightEnabled(false);
        });
    }
}
