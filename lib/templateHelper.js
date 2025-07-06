/*
  Copyright 2011 the JSDoc Authors.
  Modifications Copyright 2025 Frank Kudermann - alphanull.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

/**
 * Shared template helper functions for Vision Theme JSDoc templates.
 * Provides helper functions for template rendering, link and filename generation, doclet processing,
 * signature formatting, navigation, ancestor and member analysis, and much more.
 * This module is imported and used by the main publish module and by view templates to generate
 * all links, URLs, IDs, class/module structures, type stringifications, and to prune/filter/organize
 * doclets for display in the generated documentation.
 * All functions are pure or module-level; no classes or persistent state except for the cached
 * lookup maps (links, files, IDs, tutorials). The module is **theme-internal** and should not be used
 * as a public API.
 * @module   lib/templateHelper
 * @requires @jsdoc/name
 * @requires @jsdoc/tag
 * @requires catharsis
 * @author   JSDoc Authors
 * @author   Frank Kudermann - alphanull.de (modifications)
 * @license  Apache-2.0
 * @see      https://github.com/alphanull/jsdoc-theme-vision
 */

import { longnamesToTree, SCOPE, SCOPE_TO_PUNC } from '@jsdoc/name';
import { inline } from '@jsdoc/tag';
import catharsis from 'catharsis';

let env = null;

/**
 * Set the current JSDoc environment object for use by helpers.
 * Must be called before most other functions.
 * @param {Object} envArg  The JSDoc environment object (`env`).
 */
export function setEnv(envArg) {
    env = envArg;
}

const MODULE_NAMESPACE = 'module:';
const files = {};
const ids = {};
const containers = ['class', 'module', 'external', 'namespace', 'mixin', 'interface']; // each container gets its own html file
const hasOwnProp = Object.prototype.hasOwnProperty;

export const globalName = SCOPE.NAMES.GLOBAL;
export const fileExtension = '.html';
export { SCOPE_TO_PUNC };

const linkMap = {
    // two-way lookup
    longnameToUrl: {},
    urlToLongname: {},
    // one-way lookup (IDs are only unique per file)
    longnameToId: {}
};

let tutorials;

// two-way lookup
const tutorialLinkMap = {
    nameToUrl: {},
    urlToName: {}
};

/**
 * Set the root tutorials node for tutorial link generation.
 * @param {Object} root  Root tutorial node.
 */
export function setTutorials(root) {
    tutorials = root;
}

/**
 * Generate a URL for a given tutorial name.
 * Registers the tutorial in the tutorial link map if needed.
 * Returns `null` and logs an error if the tutorial does not exist.
 * @param   {string}      tutorial  The name of the tutorial.
 * @returns {string|null}           The generated URL for the tutorial, or `null` if not found.
 */
export function tutorialToUrl(tutorial) {
    let fileUrl;
    const node = tutorials.getByName(tutorial);

    // no such tutorial
    if (!node) {
        console.error(new Error(`No such tutorial: ${tutorial}`)); // eslint-disable-line no-console
        return null;
    }

    // define the URL if necessary
    if (!hasOwnProp.call(tutorialLinkMap.nameToUrl, node.name)) {
        fileUrl = `tutorial-${getUniqueFilename(node.name)}`;
        tutorialLinkMap.nameToUrl[node.name] = fileUrl;
        tutorialLinkMap.urlToName[fileUrl] = node.name;
    }

    return tutorialLinkMap.nameToUrl[node.name];
}

/**
 * Retrieve a link to a tutorial, or the name of the tutorial if the tutorial is missing.
 * If the `missingOpts` parameter is supplied, the names of missing tutorials will be prefixed by
 * the specified text and wrapped in the specified HTML tag and CSS class.
 * @param   {string} tutorial                 The name of the tutorial.
 * @param   {string} [content]                The link text to use. Defaults to the tutorial title.
 * @param   {Object} [missingOpts]            Options for displaying the name of a missing tutorial.
 * @param   {string} [missingOpts.classname]  The CSS class to wrap around the tutorial name.
 * @param   {string} [missingOpts.prefix]     The prefix to add to the tutorial name.
 * @param   {string} [missingOpts.tag]        The tag to wrap around the tutorial name.
 * @returns {string}                          HTML link to the tutorial, or the name of the tutorial with the specified options.
 */
export function toTutorial(tutorial, content, missingOpts) {

    let link;

    if (!tutorial) {
        console.error(new Error('Missing required parameter: tutorial')); // eslint-disable-line no-console
        return null;
    }

    const node = tutorials.getByName(tutorial);
    // no such tutorial
    if (!node) {
        const opts = missingOpts || {};
        const { tag } = opts;
        const { classname } = opts;

        link = tutorial;
        if (opts.prefix) link = opts.prefix + link;

        if (tag) {
            link = `<${tag}${classname ? ` class="${classname}">` : '>'}${link}`;
            link += `</${tag}>`;
        }

        return link;
    }

    return `<a href="${tutorialToUrl(tutorial)}">${content || node.title}</a>`;
}

export const { longnameToUrl } = linkMap;
export const { longnameToId } = linkMap;

/**
 * Register a mapping from a doclet's longname to its file URL and back.
 * @param {string} longname  The doclet's longname.
 * @param {string} fileUrl   The file URL assigned to the doclet.
 */
export function registerLink(longname, fileUrl) {
    linkMap.longnameToUrl[longname] = fileUrl;
    linkMap.urlToLongname[fileUrl] = longname;
}

/**
 * Register a mapping from a doclet's longname to its fragment ID.
 * @param {string} longname  The doclet's longname.
 * @param {string} fragment  The fragment ID assigned to the doclet.
 */
export function registerId(longname, fragment) {
    linkMap.longnameToId[longname] = fragment;
}

/**
 * Returns the namespace string for a given kind, if it is a known namespace.
 * Supports both new (ESM) and classic (CJS) JSDoc dictionary structures.
 * @param   {string} kind        The kind to check (e.g., 'module', 'namespace').
 * @param   {Object} dictionary  The tag dictionary object or config.
 * @returns {string}             The namespace prefix or an empty string.
 */
function getNamespace(kind, dictionary) {
    // If the dictionary provides the isNamespace() method (ESM JSDoc)
    if (dictionary && typeof dictionary.isNamespace === 'function') {
        return dictionary.isNamespace(kind) ? `${kind}:` : '';
    }
    // If the dictionary is a config object with a 'dictionaries' array (classic JSDoc)
    if (dictionary && Array.isArray(dictionary.dictionaries)) {
        return dictionary.dictionaries.includes(kind) ? `${kind}:` : '';
    }
    // Default: not a namespace
    return '';
}

/**
 * Formats a doclet's name for use in a documentation link.
 * Prepends namespace and scope punctuation (except "#", which is reserved for fragments),
 * and appends variation if present.
 * @param   {Object} doclet              The doclet to format.
 * @param   {string} doclet.kind         The doclet kind (e.g. "class", "function").
 * @param   {string} [doclet.name]       The doclet's (short) name.
 * @param   {string} [doclet.variation]  The doclet's variation (for overloaded signatures).
 * @param   {string} [doclet.scope]      The scope of the doclet (e.g. "instance", "static").
 * @returns {string}                     The formatted name for use in a link.
 */
function formatNameForLink(doclet) {

    const dictionary = env.tags || env.conf.tags;
    let newName = getNamespace(doclet.kind, dictionary) + (doclet.name || '') + (doclet.variation || '');
    const scopePunc = SCOPE_TO_PUNC[doclet.scope] || '';

    // Only prepend the scope punctuation if it's not the same character that marks the start of a
    // fragment ID. Using `#` in HTML5 fragment IDs is legal, but URLs like `foo.html##bar` are
    // just confusing.
    if (scopePunc !== '#') newName = scopePunc + newName;
    return newName;
}

/**
 * Ensures that the filename is unique by appending underscores as needed.
 * Does not allow filenames to begin with an underscore; will prepend a dash in such cases.
 * Stores the resulting filename in the files cache to ensure uniqueness.
 * @param   {string} filename  The proposed filename (case-insensitive).
 * @param   {string} str       The value to associate with the unique filename in the files cache.
 * @returns {string}           The unique filtered filename.
 */
function makeUniqueFilename(filename, str) {

    let key = filename.toLowerCase();
    let nonUnique = true;
    let fileName = filename;
    // don't allow filenames to begin with an underscore
    if (!fileName.length || fileName[0] === '_') {
        fileName = `-${fileName}`;
        key = fileName.toLowerCase();
    }

    // append enough underscores to make the filename unique
    while (nonUnique) {
        if (Object.hasOwn(files, key)) {
            fileName += '_';
            key = fileName.toLowerCase();
        } else {
            nonUnique = false;
        }
    }

    files[key] = str;

    return fileName;
}

/**
 * Convert a string to a unique filename, including an extension.
 * Filenames are cached to ensure that they are used only once. For example, if the same string is passed in twice, two different filenames will be returned.
 * Also, filenames are not considered unique if they are capitalized differently but are otherwise identical.
 * @param   {string} str  The string to convert.
 * @returns {string}      The filename to use for the string.
 */
export function getUniqueFilename(str) {

    const dictionary = env.tags || env.conf.tags;

    // In templateHelper.js, in getUniqueFilename:
    const namespaces = dictionary && typeof dictionary.getNamespaces === 'function'
        ? dictionary.getNamespaces().join('|')
        : dictionary && Array.isArray(dictionary.dictionaries)
            ? dictionary.dictionaries.join('|')
            : '';

    let basename = (str || '')
        .replace(new RegExp(`^(${namespaces}):`), '$1-') // use - instead of : in namespace prefixes
        .replace(/[\\/?*:|'"<>]/g, '_') // replace characters that can cause problems on some filesystems
        .replace(/~/g, '-') // use - instead of ~ to denote 'inner'
        .replace(/#/g, '_') // use _ instead of # to denote 'instance'
        .replace(/\//g, '_') // use _ instead of / (for example, in module names)
        .replace(/\([\s\S]*\)$/, '') // remove the variation, if any
        .replace(/^[.-]/, ''); // make sure we don't create hidden files, or files whose names start with a dash

    // in case we've now stripped the entire basename (uncommon, but possible):
    basename = basename.length ? basename : '_';

    return makeUniqueFilename(basename, str) + fileExtension;
}

/**
 * Resolves or generates the filename (URL) for a given doclet longname.
 * If the longname is already registered, returns the associated file URL;
 * otherwise, generates a new unique filename and registers the mapping.
 * @param   {string} longname  The doclet's longname.
 * @returns {string}           The resolved or newly generated filename (URL) for the doclet.
 */
function getFilename(longname) {
    let fileUrl;

    if (Object.hasOwn(longnameToUrl, longname)) {
        fileUrl = longnameToUrl[longname];
    } else {
        fileUrl = getUniqueFilename(longname);
        registerLink(longname, fileUrl);
    }

    return fileUrl;
}

/**
 * Check whether a symbol is the only symbol exported by a module (as in
 * `module.exports = function() {};`).
 * @private
 * @param   {module:@jsdoc/doclet.Doclet} doclet  The doclet for the symbol.
 * @returns {boolean}                             `true` if the symbol is the only symbol exported by a module; otherwise, `false`.
 */
function isModuleExports(doclet) {
    return (
        doclet.longname
        && doclet.longname === doclet.name
        && doclet.longname.indexOf(MODULE_NAMESPACE) === 0
        && doclet.kind !== 'module'
    );
}

/**
 * Generates a unique HTML5-compliant identifier for a given file and base string.
 * Ensures uniqueness by appending underscores as needed.
 * Stores the resulting ID in the ids cache for the specified filename.
 * @param   {string} filename  The filename in which the ID will be used.
 * @param   {string} id        The proposed base ID (whitespace will be removed).
 * @returns {string}           The unique identifier for use as an HTML ID.
 */
function makeUniqueId(filename, id) {

    let key;
    let nonUnique = true;

    key = id.toLowerCase();

    let idReplaced = id.replace(/\s/g, ''); // HTML5 IDs cannot contain whitespace characters

    // append enough underscores to make the identifier unique
    while (nonUnique) {
        if (Object.hasOwn(ids, filename) && Object.hasOwn(ids[filename], key)) {
            idReplaced += '_';
            key = idReplaced.toLowerCase();
        } else {
            nonUnique = false;
        }
    }

    ids[filename] = ids[filename] || {};
    ids[filename][key] = idReplaced;

    return idReplaced;
}

/**
 * Resolves or generates an HTML ID for a doclet longname and optional base ID.
 * If a mapping exists, returns the registered ID; otherwise, generates a unique ID and registers it.
 * Returns an empty string if no ID is required.
 * @param   {string} longname  The doclet's longname.
 * @param   {string} [idArg]   The proposed base ID.
 * @returns {string}           The resolved or generated HTML ID, or an empty string.
 */
function getId(longname, idArg) {
    let id = idArg;

    if (Object.hasOwn(longnameToId, longname)) {
        id = longnameToId[longname];
    } else if (id) {
        id = makeUniqueId(longname, id);
        registerId(longname, id);
    } else {
        return ''; // no ID required
    }

    return id;
}

/**
 * Convert a doclet to an identifier that is unique for a specified filename.
 *
 * Identifiers are not considered unique if they are capitalized differently but are otherwise
 * identical.
 * @function
 * @param   {string} filename  The file in which the identifier will be used.
 * @param   {string} doclet    The doclet to convert.
 * @returns {string}           A unique identifier based on the file and doclet.
 */
export { makeUniqueId as getUniqueId };

/**
 * Escape a string for safe insertion as HTML.
 * Replaces `&` and `<` with their HTML entities.
 * @param   {string} str  The string to escape.
 * @returns {string}      The escaped string.
 */
export function htmlsafe(str) {
    let string = str;
    if (typeof string !== 'string') string = String(str);
    return string.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/**
 * Escapes HTML characters in JSDoc descriptions and comments to prevent layout breaking.
 * This is specifically designed to handle cases where users include HTML-like syntax
 * in their JSDoc comments (e.g., `<pre><code>`, `<div>`, etc.).
 * @param   {string} str  The string to escape.
 * @returns {string}      The HTML-escaped string.
 */
export function escapeJSDocHTML(str) {
    if (typeof str !== 'string') return str;

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Parses a type expression using catharsis with jsdoc-flavored syntax.
 * On error, logs to the console and returns the original input.
 * @param   {string}        longname  The type expression or longname to parse.
 * @returns {Object|string}           The parsed type object, or the original string if parsing fails.
 */
function parseType(longname) {
    let err;

    try {
        return catharsis.parse(longname, { jsdoc: true, useCache: false });
    } catch (e) {
        err = new Error(`unable to parse ${longname}: ${e.message}`);
        console.error(err); // eslint-disable-line no-console
        return longname;
    }
}

/**
 * Converts a parsed catharsis type object (or string) to an HTML-safe string,
 * with optional CSS class and link map for linkifying types.
 * @param   {Object|string} typeExpression      The type expression or catharsis-parsed object.
 * @param   {string}        [cssClass]          Optional CSS class to apply to links.
 * @param   {Object}        [stringifyLinkMap]  Optional map of link targets for types.
 * @returns {string}                            The HTML-safe stringified type expression.
 */
function stringifyType(typeExpression, cssClass, stringifyLinkMap) {
    const parsedType = parseType(typeExpression);

    return catharsis.stringify(parsedType, {
        htmlSafe: true,
        linkClass: cssClass,
        links: stringifyLinkMap
    });
}

/**
 * Checks if the given text starts with a URL protocol prefix (http, https, ftp, ftps).
 * @param   {string}  text  The text to test.
 * @returns {boolean}       True if the text is a URL, false otherwise.
 */
function hasUrlPrefix(text) {
    return /^(http|ftp)s?:\/\//.test(text);
}

/**
 * Determines if a type expression is considered "complex" (record, union, or application).
 * @param   {string}  expr  The type expression to test.
 * @returns {boolean}       True if the expression is complex, false otherwise.
 */
function isComplexTypeExpression(expr) {
    // record types, type unions, and type applications all count as "complex"
    return /^{.+}$/.test(expr) || /^.+\|.+$/.test(expr) || /^.+<.+>$/.test(expr);
}

/**
 * Converts a fragment identifier to a hash for use in a URL, or returns an empty string if falsy.
 * @param   {string} fragmentId  The fragment identifier (without #).
 * @returns {string}             The fragment hash, or empty string.
 */
function fragmentHash(fragmentId) {
    if (!fragmentId) return '';
    return `#${fragmentId}`;
}

/**
 * Shortens module link names for display in documentation.
 * Handles plain module strings, event symbols, type signatures (including generics and pipes),
 * and HTML `<a>` tags containing module names.
 * @param   {string} name  The input link name or HTML string to shorten.
 * @returns {string}       - The shortened name, or the original if no rules apply.
 */
export function shortenModuleLinkName(name) {

    if (!env.config.templates.shortModuleLinkNames) return name;
    if (name.includes('{@link')) return name; // dont touch @link names

    // HTML case: Shorten ALL link texts inside <a>…</a> that start with "module:"
    if (/<a\b[^>]*>module:[^<]+<\/a>/i.test(name)) {
        return name.replace(/(<a\b[^>]*>)(module:[^<]+)(<\/a>)/gi,
            // Apply the same plain shortening logic to the link text inside <a>
            (_match, startTag, linkText, endTag) => `${startTag}${shortenModuleLinkName(linkText)}${endTag}`
        );
    }

    // Type strings with multiple modules (e.g. Array.<module:...|module:...>)
    if (/module:/.test(name) && (/[<|>]/.test(name) || (name.match(/module:/g) || []).length > 1)) {
        // Replace each occurrence of module:…/Name or module:…~Name with just the trailing name
        return name.replace(/module:([a-zA-Z0-9_/.$-]+)[/~]([a-zA-Z0-9_~$-]+)/g, (_, _prefix, lastPart) => lastPart);
    }
    // Special case: if the string ends with "#event:..." return only the event part
    const eventMatch = name.match(/#event:(.+)$/);
    if (eventMatch) return eventMatch[1];

    // Single module link: remove "module:" prefix if present
    if (name.startsWith('module:')) {
        let str = name.startsWith('module:') ? name.slice(7) : name;
        if (str.includes('/')) str = str.substring(str.lastIndexOf('/') + 1);
        return str;
    }

    // Fallback: Only shorten if it's a bare file/path, not inside an HTML tag/attribute
    if (!/^<a\b[^>]*>/i.test(name) && !name.includes('href=') && name.includes('/')) {
        const lastSegment = name.substring(name.lastIndexOf('/') + 1);
        return lastSegment || name; // defensive: ignore trailing "/"
    }

    return name;
}

/**
 * Build an HTML link to the symbol with the specified longname. If the longname is not
 * associated with a URL, this method simply returns the link text, if provided, or the longname.
 * The `longname` parameter can also contain a URL rather than a symbol's longname.
 * This method supports type applications that can contain one or more types, such as
 * `Array.<MyClass>` or `Array.<(MyClass|YourClass)>`. In these examples, the method attempts to
 * replace `Array`, `MyClass`, and `YourClass` with links to the appropriate types. The link text
 * is ignored for type applications.
 * @param   {string}  longname               The longname (or URL) that is the target of the link.
 * @param   {string}  linkText               The text to display for the link, or `longname` if no text is provided.
 * @param   {Object}  options                Options for building the link.
 * @param   {string}  options.cssClass       The CSS class (or classes) to include in the link's `<a>`  tag.
 * @param   {string}  options.fragmentId     The fragment identifier (for example, `name` in `foo.html#name`) to append to the link target.
 * @param   {string}  options.linkMap        The link map in which to look up the longname.
 * @param   {boolean} options.monospace      Indicates whether to display the link text in a monospace font.
 * @param   {boolean} options.shortLinkName  Indicates whether to extract the short name from the longname and display the short name in the link text. Ignored if `linkText` is specified.
 * @returns {string}                         The HTML link, or the link text if the link is not available.
 */
function buildLink(longname, linkText, options) {

    const classString = options.cssClass ? ` class="${options.cssClass}"` : '';
    const fragmentString = fragmentHash(options.fragmentId);
    let fileUrl;
    let text;

    // handle cases like: @see <http://example.org> or @see http://example.org
    const stripped = longname ? longname.replace(/^<|>$/g, '') : '';

    if (hasUrlPrefix(stripped)) {

        fileUrl = stripped;
        text = linkText || stripped;

    } else if (longname && isComplexTypeExpression(longname)
      && /\{@.+\}/.test(longname) === false
      && /^<[\s\S]+>/.test(longname) === false) {

        // handle complex type expressions that may require multiple links
        // (but skip anything that looks like an inline tag or HTML tag)
        const stringified = stringifyType(longname, options.cssClass, options.linkMap);
        text = options.dontShorten ? stringified : shortenModuleLinkName(stringified);
        text = options.monospace ? `<code>${text}</code>` : text;
        return text;

    } else {

        fileUrl = Object.hasOwn(options.linkMap, longname) ? options.linkMap[longname] : '';

        if (linkText) {
            text = longname.includes('#event:') || options.dontShorten ? linkText : shortenModuleLinkName(linkText);
        } else {
            text = options.dontShorten ? longname : shortenModuleLinkName(longname);
        }
    }

    // strip module path
    if (text && env.config.templates?.shortModuleLinkNames && !options.dontShorten) text = text.replace(/module:.*\/(.*)/, '$1');

    text = options.monospace ? `<code>${text}</code>` : text;

    if (!fileUrl) return text;

    return `<a href="${encodeURI(fileUrl + fragmentString).replace('##', '#')}"${classString}>${text}</a>`;

}

/**
 * Retrieve an HTML link to the symbol with the specified longname. If the longname is not
 * associated with a URL, this method simply returns the link text, if provided, or the longname.
 * The `longname` parameter can also contain a URL rather than a symbol's longname.
 * This method supports type applications that can contain one or more types, such as
 * `Array.<MyClass>` or `Array.<(MyClass|YourClass)>`. In these examples, the method attempts to
 * replace `Array`, `MyClass`, and `YourClass` with links to the appropriate types. The link text
 * is ignored for type applications.
 * @param   {string}  longname     The longname (or URL) that is the target of the link.
 * @param   {string}  linkText     The text to display for the link, or `longname` if no text is provided.
 * @param   {string}  cssClass     The CSS class (or classes) to include in the link's `<a>` tag.
 * @param   {string}  fragmentId   The fragment identifier (for example, `name` in `foo.html#name`) to append to the link target.
 * @param   {boolean} dontShorten  Do not shorten Link name.
 * @returns {string}               The HTML link, or a plain-text string if the link is not available.
 */
export function linkto(longname, linkText, cssClass, fragmentId, dontShorten) {

    return buildLink(longname, linkText, {
        cssClass,
        fragmentId,
        linkMap: longnameToUrl,
        dontShorten
    });

}

/**
 * Determines whether a given link should be rendered in monospace style.
 * Returns true for {\@linkcode} tags and (depending on config) for cleverLinks/monospaceLinks options.
 * @param   {string}  tag   The tag name ('link', 'linkplain', or 'linkcode').
 * @param   {string}  text  The link text.
 * @returns {boolean}       True if the link should be rendered in monospace, false otherwise.
 */
function useMonospace(tag, text) {

    let result;

    if (hasUrlPrefix(text)) {
        result = false;
    } else if (tag === 'linkplain') {
        result = false;
    } else if (tag === 'linkcode') {
        result = true;
    } else {
        const { config } = env,
              { cleverLinks, monospaceLinks } = config.templates;
        if (monospaceLinks || cleverLinks) result = true;
    }

    return result || false;
}

/**
 * Splits a link text into its target and display text.
 * Supports both "|" and space as separators. Normalizes newlines in the link text to a single space.
 * @param   {string} text  The full link text (may include separator).
 * @returns {Object}       An object with properties: { linkText, target }. If no separator is found, target equals the input text and linkText is undefined.
 */
function splitLinkText(text) {

    let linkText, target, splitIndex;

    // if a pipe is not present, we split on the first space
    splitIndex = text.indexOf('|');
    if (splitIndex === -1) splitIndex = text.search(/\s/);

    if (splitIndex !== -1) {
        linkText = text.substr(splitIndex + 1);
        // Normalize subsequent newlines to a single space.
        linkText = linkText.replace(/\n+/, ' ');
        target = text.substr(0, splitIndex);
    }

    if (linkText) linkText = linkText.trim();
    if (target) target = target.trim();

    return {
        linkText,
        target: target || text
    };
}

/**
 * Returns whether short names should be used for links in the generated docs.
 * Reads the value from env.config.templates.useShortNamesInLinks.
 * @returns {boolean} True if short names are enabled for links, false otherwise.
 */
function shouldShortenLongname() {

    return env.config.templates && env.config.templates.useShortNamesInLinks;

}

/**
 * Find `{@link ...}` inline tags and turn them into HTML links.
 * @param   {string} str  The string to search for `{@link ...}` tags.
 * @returns {string}      The linkified text.
 */
export function resolveLinks(str) {

    /**
     * Extracts "leading text" (enclosed in square brackets) immediately preceding a tag within a string.
     * If such leading text is found directly before the tag, it is removed from the string and returned separately.
     * @param   {string} stringArg    The full string to search for leading text and the tag.
     * @param   {string} completeTag  The tag string to find within `string`.
     * @returns {Object}              An object with properties: - {string|null} leadingText: The extracted leading text (or null if not found). - {string} string: The modified string with leading text removed if extracted.
     */
    function extractLeadingText(stringArg, completeTag) {

        const tagIndex = stringArg.indexOf(completeTag);
        const leadingTextRegExp = /\[(.+?)\]/g;

        let string = stringArg;
        let leadingText = null;
        let leadingTextInfo = leadingTextRegExp.exec(string);

        // did we find leading text, and if so, does it immediately precede the tag?
        while (leadingTextInfo && leadingTextInfo.length) {
            if (leadingTextInfo.index + leadingTextInfo[0].length === tagIndex) {
                string = string.replace(leadingTextInfo[0], '');
                leadingText = leadingTextInfo[1];
                break;
            }

            leadingTextInfo = leadingTextRegExp.exec(string);
        }

        return {
            leadingText,
            string
        };
    }

    /**
     * Processes a {@link ...} (or similar) tag within a string, replacing it with a built HTML link.
     * Handles leading text extraction, link text parsing, monospace option, and link shortening.
     * @param   {string} string               The full string containing the tag to process.
     * @param   {Object} options              Options for processing the link.
     * @param   {string} options.completeTag  The complete tag string to find and replace.
     * @param   {string} options.text         The text content of the tag.
     * @param   {string} options.tag          The tag type ('link', 'linkplain', 'linkcode', etc.).
     * @returns {string}                      The modified string with the tag replaced by the generated HTML link.
     */
    function processLink(string, { completeTag, text, tag }) {

        const leading = extractLeadingText(string, completeTag);
        const split = splitLinkText(text);
        const { target } = split;
        const linkText = leading.leadingText || split.linkText;
        const monospace = useMonospace(tag, text);

        return leading.string.replace(
            completeTag,
            buildLink(target, linkText, {
                linkMap: longnameToUrl,
                monospace,
                shortLinkName: shouldShortenLongname()
            })
        );
    }

    const replacers = {
        link: processLink,
        linkcode: processLink,
        linkplain: processLink
    };

    return inline.replaceInlineTags(str, replacers).newString;
}

/**
 * Convert tag text like `Jane Doe <jdoe@example.org>` into a `mailto:` link.
 * @param   {string} str  The tag text.
 * @returns {string}      The linkified text.
 */
export function resolveAuthorLinks(str) {
    let author = '';
    let matches;

    if (str) {
        matches = str.match(/^\s?([\s\S]+)\b\s+<(\S+@\S+)>\s?$/);

        if (matches && matches.length === 3) {
            author = `<a href="mailto:${matches[2]}">${htmlsafe(matches[1])}</a>`;
        } else {
            author = htmlsafe(str);
        }
    }

    return author;
}

/**
 * Retrieve all of the following types of members from a set of doclets:
 * + Classes
 * + Externals
 * + Globals
 * + Mixins
 * + Modules
 * + Namespaces
 * + Events.
 * @param   {Object} data  The TaffyDB database to search.
 * @returns {Object}       An object with `classes`, `externals`, `globals`, `mixins`, `modules`, `events`, and `namespaces` properties. Each property contains an array of objects.
 */
export function getMembers(data) {
    const members = {
        classes: find(data, { kind: 'class' }),
        externals: find(data, { kind: 'external' }),
        events: find(data, { kind: 'event' }),
        globals: find(data, {
            kind: ['enum', 'member', 'function', 'constant', 'typedef'],
            memberof: { isUndefined: true }
        }),
        mixins: find(data, { kind: 'mixin' }),
        modules: find(data, { kind: 'module' }),
        namespaces: find(data, { kind: 'namespace' }),
        interfaces: find(data, { kind: 'interface' })
    };

    // strip quotes from externals, since we allow quoted names that would normally indicate a
    // namespace hierarchy (as in `@external "jquery.fn"`)
    // TODO: we should probably be doing this for other types of symbols, here or elsewhere; see
    // jsdoc3/jsdoc#396
    members.externals = members.externals.map(doclet => {
        doclet.name = doclet.name.replace(/(^"|"$)/g, '');
        return doclet;
    });

    // functions that are also modules (as in `module.exports = function() {};`) are not globals
    members.globals = members.globals.filter(doclet => !isModuleExports(doclet));

    return members;
}

/**
 * Retrieve the member attributes for a doclet (for example, `virtual`, `static`, and `readonly`).
 * @param   {Object}        d  The doclet whose attributes will be retrieved.
 * @returns {Array<string>}    The member attributes for the doclet.
 */
export function getAttribs(d) {
    const attribs = [];

    if (!d) return attribs;

    if (d.async) attribs.push('async');
    if (d.generator) attribs.push('generator');
    if (d.virtual) attribs.push('abstract');
    if (d.access && d.access !== 'public') attribs.push(d.access);
    if (d.readonly === true && d.kind === 'member') attribs.push('readonly');
    if (d.kind === 'constant') attribs.push('constant');

    if (d.scope && d.scope !== 'instance' && d.scope !== SCOPE.NAMES.GLOBAL) {
        if (d.kind === 'function' || d.kind === 'member' || d.kind === 'constant') {
            attribs.push(d.scope);
        }
    }

    if (d.nullable === true) {
        attribs.push('nullable');
    } else if (d.nullable === false) {
        attribs.push('non-null');
    }

    return attribs;
}

/**
 * Retrieves HTML links to all allowed types for the member.
 * For each allowed type, generates a link using the provided CSS class.
 * @param   {Object}        d           The doclet whose types will be retrieved.
 * @param   {Object}        [d.type]    The type definition object, typically with a `names` array property.
 * @param   {string}        [cssClass]  Optional CSS class to include in the `class` attribute of each generated link.
 * @returns {Array<string>}             Array of HTML links to allowed types for the member.
 */
export function getSignatureTypes({ type }, cssClass) {
    let types = [];

    if (type && type.names) types = type.names;
    if (types && types.length) types = types.map(t => linkto(t, htmlsafe(t), cssClass));

    return types;
}

/**
 * Retrieves the names of the parameters that the member accepts.
 * If a value is provided for `optClass`, names of optional parameters will be wrapped in a `<span>` tag with that class.
 * @param   {Object}        d           The doclet whose parameter names will be retrieved.
 * @param   {Array<Object>} [d.params]  Array of parameter objects as parsed by JSDoc.
 * @param   {string}        [optClass]  Optional CSS class to assign to the `<span>` tag wrapping optional parameter names. If not provided, optional parameter names will not be wrapped.
 * @returns {Array<string>}             Array of parameter names, with or without `<span>` tags wrapping the names of optional parameters.
 */
export function getSignatureParams({ params }, optClass) {
    const pnames = [];

    if (params) {
        params.forEach(p => {
            if (p.name && !p.name.includes('.')) {
                if (p.optional && optClass) {
                    pnames.push(`<span class="${optClass}">${p.name}</span>`);
                } else {
                    pnames.push(p.name);
                }
            }
        });
    }

    return pnames;
}

/**
 * Retrieves links to types that the member can return or yield.
 * If both `yields` and `returns` are present, yields takes precedence.
 * @param   {Object}        d            The doclet whose return or yield types will be retrieved.
 * @param   {Array<Object>} [d.yields]   The list of yield definitions (typically from a generator).
 * @param   {Array<Object>} [d.returns]  The list of return definitions.
 * @param   {string}        [cssClass]   Optional CSS class to include in each link.
 * @returns {Array<string>}              Array of HTML links to types that the member can return or yield.
 */
export function getSignatureReturns({ yields, returns }, cssClass) {
    let returnTypes = [];

    if (yields || returns) {
        (yields || returns).forEach(r => {
            if (r && r.type && r.type.names) {
                if (!returnTypes.length) {
                    returnTypes = r.type.names;
                }
            }
        });
    }

    if (returnTypes && returnTypes.length) {
        returnTypes = returnTypes.map(r => linkto(r, htmlsafe(r), cssClass));
    }

    return returnTypes;
}

/**
 * Retrieve an ordered list of doclets for a symbol's ancestors.
 * @param   {Object}                              data    The TaffyDB database to search.
 * @param   {Object}                              doclet  The doclet whose ancestors will be retrieved.
 * @returns {Array.<module:@jsdoc/doclet.Doclet>}         A array of ancestor doclets, sorted from most to least distant.
 */
export function getAncestors(data, doclet) {
    const ancestors = [];
    let doc = doclet;
    let previousDoc;

    while (doc) {
        previousDoc = doc;
        doc = find(data, { longname: doc.memberof })[0];
        // prevent infinite loop that can be caused by duplicated module definitions
        if (previousDoc === doc) break;
        if (doc) ancestors.unshift(doc);
    }

    return ancestors;
}

/**
 * Retrieve links to a member's ancestors.
 * @param   {Object}         data        The TaffyDB database to search.
 * @param   {Object}         doclet      The doclet whose ancestors will be retrieved.
 * @param   {string}         [cssClass]  The CSS class to include in the `class` attribute for each link.
 * @returns {Array.<string>}             HTML links to a member's ancestors.
 */
export function getAncestorLinks(data, doclet, cssClass) {
    const ancestors = getAncestors(data, doclet);
    const links = [];

    ancestors.forEach(ancestor => {
        const linkText = (SCOPE_TO_PUNC[ancestor.scope] || '') + ancestor.name;
        const link = linkto(ancestor.longname, linkText, cssClass);

        links.push(link);
    });

    if (links.length) links[links.length - 1] += SCOPE_TO_PUNC[doclet.scope] || '';

    return links;
}

/**
 * Iterates through all the doclets in `data`, ensuring that if a method `@listens` to an event,
 * then that event has a `listeners` array with the longname of the listener in it.
 * @param {Object} data  The TaffyDB database to search.
 */
export function addEventListeners(data) {
    // just a cache to prevent me doing so many lookups
    const _events = {};
    let doc;
    let l;
    // TODO: do this on the *pruned* data
    // find all doclets that @listen to something.
    const listeners = find(data, function() { return this.listens && this.listens.length; }); // eslint-disable-line no-invalid-this

    if (!listeners.length) return;

    listeners.forEach(({ listens, longname }) => {
        l = listens;
        l.forEach(eventLongname => {
            doc = _events[eventLongname] || find(data, { longname: eventLongname, kind: 'event' })[0];
            if (doc) {
                if (doc.listeners) {
                    doc.listeners.push(longname);
                } else {
                    doc.listeners = [longname];
                }
                _events[eventLongname] = _events[eventLongname] || doc;
            }
        });
    });
}

/**
 * Find items in a TaffyDB database that match the specified key-value pairs.
 * @function
 * @param   {Object}            data  The TaffyDB database to search.
 * @param   {object | Function} spec  Key-value pairs to match against (for example, `{ longname: 'foo' }`), or a function that returns `true` if a value matches or `false` if it does not match.
 * @returns {Array<object>}           The matching items.
 */
export function find(data, spec) {
    return data(spec).get();
}

/**
 * Remove members that will not be included in the output, including:
 *
 * + Undocumented members.
 * + Members tagged `@ignore`.
 * + Members of anonymous classes.
 * + Members tagged `@private`, unless the `private` option is enabled.
 * + Members tagged with anything other than specified by the `access` options.
 * @param   {Object} data  The TaffyDB database to prune.
 * @returns {Object}       The pruned database.
 */
export function prune(data) {

    const { options } = env;

    data({ undocumented: true }).remove();
    data({ ignore: true }).remove();
    data({ memberof: '<anonymous>' }).remove();

    if (!options.access || options.access && !options.access.includes('all')) {

        if (options.access && !options.access.includes('package')) {
            data({ access: 'package' }).remove();
        }

        if (options.access && !options.access.includes('public')) {
            data({ access: 'public' }).remove();
        }

        if (options.access && !options.access.includes('protected')) {
            data({ access: 'protected' }).remove();
        }

        if (!options.private && (!options.access || options.access && !options.access.includes('private'))) {
            data({ access: 'private' }).remove();
        }

        if (options.access && !options.access.includes('undefined')) {
            data({ access: { isUndefined: true } }).remove();
        }
    }

    return data;
}

/**
 * Create a URL that points to the generated documentation for the doclet.
 *
 * If a doclet corresponds to an output file (for example, if the doclet represents a class), the
 * URL will consist of a filename.
 *
 * If a doclet corresponds to a smaller portion of an output file (for example, if the doclet
 * represents a method), the URL will consist of a filename and a fragment ID.
 * @param   {module:@jsdoc/doclet.Doclet} doclet  The doclet that will be used to create the URL.
 * @returns {string}                              The URL to the generated documentation for the doclet.
 */
export function createLink(doclet) {

    const { longname } = doclet;

    let fakeContainer;
    let filename;
    let fragment = '';
    let match;

    // handle doclets in which doclet.longname implies that the doclet gets its own HTML file, but
    // doclet.kind says otherwise. this happens due to mistagged JSDoc (for example, a module that
    // somehow has doclet.kind set to `member`).
    // TODO: generate a warning (ideally during parsing!)
    if (!containers.includes(doclet.kind)) {
        match = /(\S+):/.exec(longname);
        if (match && containers.includes(match[1])) {
            fakeContainer = match[1];
        }
    }

    if (containers.includes(doclet.kind) || isModuleExports(doclet)) {
        // the doclet gets its own HTML file
        filename = getFilename(longname);
    } else if (!containers.includes(doclet.kind) && fakeContainer) {
        // mistagged version of a doclet that gets its own HTML file
        filename = getFilename(doclet.memberof || longname);
        if (doclet.name !== doclet.longname) {
            fragment = formatNameForLink(doclet);
            fragment = getId(longname, fragment);
        }
    } else {
        // the doclet is within another HTML file
        filename = getFilename(doclet.memberof || globalName);
        if (doclet.name !== doclet.longname || doclet.scope === SCOPE.NAMES.GLOBAL) {
            fragment = formatNameForLink(doclet);
            fragment = getId(longname, fragment);
        }
    }

    const fileUrl = encodeURI(filename + fragmentHash(fragment));

    return fileUrl;
}

/**
 * Convert an array of doclet longnames into a tree structure, optionally attaching doclets to the
 * tree.
 * @function
 * @param   {Array<string>}                               longnames  The longnames to convert into a tree.
 * @param   {Object<string, module:@jsdoc/doclet.Doclet>} doclets    The doclets to attach to a tree. Each property should be the longname of a doclet, and each value should be the doclet for that longname.
 * @returns {Object}                                                 A tree with information about each longname.
 * @see module:@jsdoc/name.longnamesToTree
 */
export { longnamesToTree };
