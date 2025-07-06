/**
 * Search popup and fuzzy matching for JSDoc Vision Theme.
 * This module provides the search UI and fuzzy search logic for the documentation site.
 * It loads the prebuilt search index (index.json), opens a popup search overlay,
 * performs client-side searches using Fuse.js, and highlights matches in the result list.
 * - Uses the Popup component for modal display.
 * - Fetches index data asynchronously on first open.
 * - Performs fuzzy matching on title and description.
 * - Highlights matching fragments in both title and description.
 * - Limits search to queries with 3 or more characters.
 * - Only displays up to 20 results.
 * @module   theme/search
 * @requires ui/Popup
 * @author   Frank Kudermann - alphanull.de
 * @version  1.0.0
 * @license  MIT
 */
export default {
    init
};

import Popup from '../ui/Popup.js';
import Fuse from 'fuse.js';

// Main variables for DOM elements and search state
let index, indexPromise, fuse, input, results, searchButton, searchBox, isVirtualKeyboardOpen;

// Create the popup instance for the search overlay
const puSearch = new Popup({
    viewClass: 'search-popup',
    orientation: ['bottom'],
    margins: {
        top: 10,
        bottom: 10,
        right: 20,
        left: 10
    },
    onHide: () => !isVirtualKeyboardOpen,
    onHidden: () => document.documentElement.classList.remove('has-search-popup'),
    onShow: () => document.documentElement.classList.add('has-search-popup'),
    onVisible: () => input.focus() // When the popup becomes visible, focus the input field
});

/**
 * Loads the search index from the generated JSON file.
 * Fetches data asynchronously and parses as JSON.
 * @returns {Promise<Array>} The parsed index data, or undefined on failure.
 */
async function loadIndex() {
    try {
        const result = await fetch('static/index.json');
        if (!result.ok) {
            // eslint-disable-next-line no-console
            console.error(`Index Data could not be loaded due to network error: ${result.status}`);
        }
        return await result.json();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Index data loading failed', { cause: error });
    }
}

/**
 * Opens the search popup and initializes Fuse.js if necessary.
 * Loads the index on first open and sets up fuzzy search.
 * @param {Event} event  The click event triggering the popup.
 */
async function openSearchBox(event) {

    puSearch.show(searchBox, event);
    input.value = '';
    results = document.getElementById('search-results');

    if (!index) {

        results.innerHTML = '<p><b>Loading index ... </b></p>';
        input.disabled = true;

        if (!indexPromise) indexPromise = loadIndex();

        index = await indexPromise; // eslint-disable-line require-atomic-updates
        indexPromise = null; // eslint-disable-line require-atomic-updates

        // Initialize Fuse.js for fuzzy search on title and description
        fuse = new Fuse(index, {
            keys: ['title', 'description'],
            threshold: 0.3, // 0.3–0.4 is more intuitive than default 0.6
            minMatchCharLength: 3,
            includeScore: true, // Return score for debug
            includeMatches: true // Needed for highlighting
        });

        input.disabled = false;
        input.focus();
    }

    results.innerHTML = '<p><b>Type to search ... </b></p>';

}

/**
 * Highlights matching fragments of the string using `<mark>` tags.
 * @param   {string}               str      The full string to be highlighted.
 * @param   {Array<Array<number>>} indices  Array of [start, end] index pairs.
 * @returns {string}                        The string with `<mark>` tags wrapping matched segments.
 */
function highlightMatches(str, indices) {
    // Sort indices in reverse order by start index to avoid messing up positions
    let result = str;
    const indicesSorted = [...indices].sort((a, b) => b[0] - a[0]);
    for (const [start, end] of indicesSorted) {
        // End is inclusive, so +1 for slice()
        result = `${result.slice(0, start)}<mark>${result.slice(start, end + 1)}</mark>${result.slice(end + 1)}`;
    }
    return result;
}

/**
 * Handles search input events and updates the results list.
 * Performs fuzzy search if the query is at least 3 characters long.
 * Highlights matches in both title and description.
 * @param {InputEvent} event  The input event from the search field.
 */
function onInput(event) {

    const query = event.target.value.trim();
    results.innerHTML = '<p><b>Type to search ... </b></p>';

    if (query.length < 3) return; // Only search if query is 3+ characters

    const found = fuse.search(query).slice(0, 20); // Limit to 20 results for performance and usability

    if (found.length === 0) {
        results.innerHTML = '<p><b>No results</b></p>';
        return;
    }

    results.innerHTML = '';

    // Render each result with highlighted matches
    for (const result of found) {
        const { item, matches } = result;
        let { title } = item;
        let desc = item.description;

        if (matches) {
            for (const match of matches) {
                if (match.key === 'title') title = highlightMatches(title, match.indices);
                if (match.key === 'description') desc = highlightMatches(desc, match.indices);
            }
        }

        const li = document.createElement('li');
        li.innerHTML = `<a href="${item.link}">
            <h2>${title}</h2>
            <p>${desc}</p>
        </a>`;
        results.appendChild(li);
    }
}

/**
 * Initializes the search popup and event listeners.
 * Called once on page load by the theme entrypoint.
 * @memberof module:theme/search
 */
export function init() {

    searchBox = document.getElementById('search');

    input = document.getElementById('search-input');
    input.addEventListener('input', onInput); // Live search on input

    searchButton = document.getElementById('search-button');
    searchButton.addEventListener('click', openSearchBox); // Open popup on button click

    if ('visualViewport' in window) {
        const VIEWPORT_VS_CLIENT_HEIGHT_RATIO = 0.75;
        window.visualViewport.addEventListener('resize', event => {
            if (event.target.height * event.target.scale / window.screen.height < VIEWPORT_VS_CLIENT_HEIGHT_RATIO) {
                isVirtualKeyboardOpen = true;
            } else {
                isVirtualKeyboardOpen = false;
            }
        });
    }

}
