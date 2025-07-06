/**
 * Initializes code highlighting and adds line numbers for code blocks.
 * Uses Highlight.js to apply syntax highlighting to all code blocks in the documentation.
 * Adds line numbering to each code block using an ordered list and enables anchor navigation
 * to specific lines via URL hashes (e.g. #line12).
 * This script is imported and executed automatically as part of the theme's client-side JS bundle.
 * @module   theme/syntax
 * @requires @highlightjs/cdn-assets/es/highlight.js
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 */
export default {
    init
};

import hljs from '@highlightjs/cdn-assets/es/highlight.js';

// Register a plugin to add line numbers and anchor support after each code block is highlighted.
hljs.addPlugin({
    'after:highlightElement': ({ el, result }) => {

        /**
         * Splits Highlight.js HTML output into lines, duplicating any open span styles across line breaks.
         * Ensures every line is valid HTML with full span context (for robust line numbering).
         * @param   {string}   html  The highlighted code HTML from HLJS.
         * @returns {string[]}       Array of line-HTML, each one fully styled.
         */
        function splitHighlightedHtmlIntoLines(html) {
            // Quick escape: no tags, just split
            if (!/<span|<br/i.test(html)) return html.split('\n');

            const lines = [];
            const openTags = [];

            let buffer = '';

            // Use a RegExp to match tags and line breaks
            const tagOrLinebreak = /(<\/?span\b[^>]*>)|(\r\n|\r|\n)/gi;

            let match,
                lastIndex = 0;

            while ((match = tagOrLinebreak.exec(html)) !== null) {
                if (match.index > lastIndex) buffer += html.slice(lastIndex, match.index);

                if (match[2]) {
                    // Line break: finish the current line
                    lines.push(openTags.join('') + buffer + openTags.map(() => '</span>').reverse().join(''));
                    buffer = '';
                } else if (match[1]) {
                    const tag = match[1];
                    if (/^<span\b/i.test(tag)) {
                        buffer += tag;
                        openTags.push(tag);
                    } else if (/^<\/span/i.test(tag)) {
                        buffer += tag;
                        openTags.pop();
                    }
                }

                // eslint-disable-next-line prefer-destructuring
                lastIndex = tagOrLinebreak.lastIndex;

            }

            if (lastIndex < html.length) buffer += html.slice(lastIndex);
            lines.push(openTags.join('') + buffer + openTags.map(() => '</span>').reverse().join(''));

            return lines;
        }

        const shouldAddLineNumbers = el.parentElement.classList.contains('linenums') || el.classList.contains('linenums');
        if (!shouldAddLineNumbers) return; // skip if not marked for line numbers

        const codeHtml = result.value, // The highlighted code as HTML, split by line breaks.
              lines = splitHighlightedHtmlIntoLines(codeHtml), // Split into lines, keeping all HTML tags per line.
              anchorHash = document.location.hash.substring(1), // Get the anchor from the URL hash (if present).
              ol = document.createElement('ol'); // Create an <ol> for the line numbers.

        ol.className = 'hljs-ln';

        lines.forEach((line, idx) => {
            // Do not render the last empty line to avoid a ghost <li>.
            if (idx === lines.length - 1 && line === '') return;
            const lineId = `line${idx + 1}`;
            const li = document.createElement('li');
            li.innerHTML = line || '\u200B'; // Render an empty line as a zero-width space for correct height.
            li.id = `line${idx + 1}`; // Assign a unique ID for each line for deep-linking.
            if (anchorHash === lineId) li.classList.add('is-selected'); // Highlight the line if it matches the anchor in the URL.
            ol.appendChild(li);
        });

        // Remove any previous content and insert the generated OL with lines.
        el.innerHTML = '';
        el.appendChild(ol);
    }
});

/**
 * Applies syntax highlighting and line numbering to all relevant code blocks in the document.
 * @memberof module:theme/syntax
 * @param {string} [selector=".prettyprint code"]  Specifies where to apply the code coloring.
 */
export function init(selector = '.prettyprint code') {

    // Highlight all regular code blocks
    document.querySelectorAll(selector).forEach(el => {
        hljs.highlightElement(el);
    });

}
