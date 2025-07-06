/**
 * Entry point for Vision Theme client-side interactivity.
 * This script initializes all interactive UI components and behaviors
 * for the JSDoc Vision Theme documentation pages.
 * The file is included in the generated HTML output and is responsible for:
 * - Initializing popups and dialogs (settings panel, etc.).
 * - Setting up navigation, including dual sticky sidebar logic and mobile menu.
 * - Enabling scroll lock for overlays.
 * - Injecting search, syntax highlighting, and dark mode support.
 * - Making sections collapsible/foldable.
 * - Managing visibility of private members.
 * - Handling sidebar toggle (show/hide) state, persisted in localStorage.
 * All component modules are imported in ESModule style.
 * DOMContentLoaded is not required; script is injected at the end of the body.
 * @module   main
 * @requires nav/navMain
 * @requires nav/navMobile
 * @requires nav/lockScroll
 * @requires nav/dualStickyNav
 * @requires theme/search
 * @requires theme/syntax
 * @requires theme/privates
 * @requires theme/copyCode
 * @requires theme/search
 * @requires ui/darkmode
 * @requires ui/foldable
 * @requires ui/fontsize
 * @requires ui/Popup
 * @requires ui/scroll
 * @requires ui/foldable
 * @requires util/publisher
 * @author   Frank Kudermann @ alphanull
 * @version  1.0.0
 * @license  MIT
 * @see https://github.com/alphanull/jsdoc-theme-vision
 */

// setup settings popup
import Popup from './ui/Popup.js';
const puSettings = new Popup({
    margins: {
        top: 10,
        bottom: 10,
        right: 20,
        left: 10
    },
    onShow: () => { document.documentElement.classList.add('has-settings-popup'); },
    onHidden: () => { document.documentElement.classList.remove('has-settings-popup'); },
    orientation: ['bottom']
});
document.getElementById('settings-button').addEventListener('click', event => puSettings.show(document.getElementById('settings'), event));

// setup main navigation
import navMain from './nav/navMain.js';
navMain.init('#nav-main-wrapper');

// setup Sticky behavior for sidebar
import dualStickyNav from './nav/dualStickyNav.js';
dualStickyNav.init(document.getElementById('nav-aside'));

// lockscroll helper prevents scolling when popup or mobile nav is active
import lockScroll from './nav/lockScroll.js';
lockScroll.init();

// setup mobile navigation
import menuMobile from './nav/navMobile.js';
menuMobile.init(document.getElementById('nav-main-wrapper'), {
    preventDefault: true,
    initiator: document.getElementById('menu-mobile-button'),
    closeTrigger: document.getElementById('menu-mobile-close'),
    insertBefore: document.getElementById('wrapper-global')
});

// setup search
import search from './theme/search.js';
search.init();

// setup snytax highlighting
import syntax from './theme/syntax.js';
syntax.init('.prettyprint code');

// setup dark mode switch
import darkmode from './ui/darkmode.js';
darkmode.init();

// setup foldbale sections
import foldable from './ui/foldable.js';
foldable.init({ headerSelector: 'h3.name' });

// setup privates display
import privates from './theme/privates.js';
privates.init();

// copy code
import copyCode from './theme/copyCode.js';
copyCode.init('pre > code');

// smooth scrolling
import scroll from './ui/scroll.js';
scroll.init(document);

// setup font size slider
import uiScale from './ui/uiScale.js';
uiScale.init(puSettings);

// setup font selector
import fontSelector from './ui/fontSelector.js';
fontSelector.init(puSettings);

// theme selector
const skinSelector = document.getElementById('skin-select');
if (skinSelector) {
    skinSelector.addEventListener('change', event => {
        document.documentElement.dataset.skin = event.target.value;
        if (window.localStorage) window.localStorage.setItem('skin', event.target.value);
    });

    const skin = window.localStorage && window.localStorage.getItem('skin') || document.documentElement.dataset.skin;
    if (skin) {
        Array.from(document.getElementById('skin-select').children).forEach(child => {
            if (child.value === skin) child.selected = true;
        });
    }
}

// sidebar display
if (window.localStorage) {
    const showSidebar = window.localStorage.getItem('showSidebar');
    if (showSidebar === 'false') document.getElementById('sidebar-settings').checked = false;
}

document.getElementById('sidebar-settings').addEventListener('change', () => {
    document.documentElement.classList.toggle('no-sidebar', !event.target.checked);
    if (window.localStorage) window.localStorage.setItem('showSidebar', event.target.checked ? 'true' : 'false');
});
