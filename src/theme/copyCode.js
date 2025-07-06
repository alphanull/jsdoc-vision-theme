/**
 * Copy-to-clipboard functionality for code blocks in the VisionTheme JSDoc template.
 * This module provides a client-side utility that adds copy-to-clipboard buttons to all
 * code blocks in the generated documentation. When users click the copy button, the
 * code content is copied to their clipboard with proper text cleaning (removing zero-width
 * characters that can interfere with copying).
 * The module automatically:
 * - Finds all code blocks matching the specified selector
 * - Adds a copy button with proper accessibility attributes
 * - Handles clipboard operations using the modern Clipboard API
 * - Provides visual feedback when copying is successful
 * - Cleans the copied text to remove problematic characters.
 * @module theme/copyCode
 * @author   Frank Kudermann - alphanull
 * @version  1.0.0
 * @license  MIT
 * @see      https://github.com/alphanull/jsdoc-theme-vision
 */
export default {
    init
};

/**
 * Initializes copy-to-clipboard functionality for code blocks in the documentation.
 * This function finds all code blocks matching the specified selector and adds a copy button
 * to each one. When clicked, the button copies the code content to the user's clipboard
 * and provides visual feedback.
 * @param {string} [selector='pre > code']  CSS selector for code blocks to enhance with copy functionality.
 */
export function init(selector = 'pre > code') {

    document.querySelectorAll(selector).forEach(code => {
        const button = document.createElement('button');
        button.className = 'icon copy-code';
        button.type = 'button';
        button.setAttribute('aria-label', 'Copy code to clipboard');
        button.title = 'Copy code to clipboard';

        code.parentNode.appendChild(button);

        button.addEventListener('click', () => {
            // extract code text
            const text = code.innerText.replace(/[\u200B-\u200D\uFEFF]/g, ''); // remove typical Zero-Width-Chars
            navigator.clipboard.writeText(text).then(() => {
                button.classList.add('is-copied');
                // eslint-disable-next-line max-nested-callbacks
                setTimeout(() => button.classList.remove('is-copied'), 1500);
            });
        });
    });
}
