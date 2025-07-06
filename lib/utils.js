/* eslint-disable no-undef */

/*
  Copyright 2010 the JSDoc Authors.
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
 * Utility functions for the VisionTheme JSDoc template.
 * This module provides core utility functions for the VisionTheme JSDoc template, handling
 * file operations, doclet processing, navigation generation, and template rendering support.
 * It serves as a bridge between the main publish module and template helpers, providing
 * essential functionality for generating documentation output.
 * Key responsibilities include:
 * - File copying and management for static assets and custom files
 * - Doclet processing and transformation (signatures, attributes, types)
 * - Navigation structure generation and member organization
 * - Template view management and environment configuration
 * - Tutorial and link generation utilities
 * - Source file generation and pretty-printing.
 * The module is designed to work with both classic (CJS) and modern (ESM) JSDoc APIs,
 * providing a unified interface for doclet handling regardless of the JSDoc version used.
 * All functions are pure or module-level with no persistent state except for cached
 * lookup maps and configuration objects.
 * This module is **theme-internal** and should not be used as a public API. It's imported
 * by the main publish module and template files to provide utility functionality.
 * @module   lib/utils
 * @requires lib/templateHelper
 * @requires fs
 * @requires path
 * @requires _
 * @requires striptags
 * @requires he
 * @author   JSDoc Authors
 * @author   Frank Kudermann - alphanull.de (modifications)
 * @license  Apache-2.0
 * @see      https://github.com/alphanull/jsdoc-theme-vision
 */

import fs from 'node:fs';
import path from 'node:path';
import * as helper from './templateHelper.js'; // All template helper utilities
import _ from 'lodash'; // Lodash utility library
import striptags from 'striptags';
import he from 'he';

// Shorthand references for common template helpers
const { htmlsafe, linkto } = helper;

/**
 * The current template view instance.
 * @type {Object}
 */
let view = null;

/**
 * Sets the template view instance for use by utility functions.
 * This allows utility functions to access template rendering capabilities.
 * @param   {Object} viewArg  The template view instance to set.
 * @returns {void}
 */
export function setView(viewArg) {
    view = viewArg;
}

/**
 * Creates a queryable taffy instance for both JSDoc classic (npm) and new (ESM) API.
 * Use `data = makeQueryableTaffy(docletStoreOrTaffy)` and always call `data(query).get()`.
 * @param   {Function | object} db  Either a taffy factory or a taffy instance (with .get()).
 * @returns {Function}              Queryable taffy factory: (query) => { get: Function }.
 * @throws  {Error}                 If no taffy instance was found.
 */
export function makeQueryableTaffy(db) {
    if (typeof db === 'function') return db; // ESM/Factory style or Classic, if still passed as function
    if (db && typeof db.get === 'function') {
        return function() {
            return {
                get: () => db.get()
            };
        };
    }
    throw new Error('makeQueryableTaffy: Invalid taffy/DB instance');
}

/**
 * Creates a directory and all parent directories as needed.
 * Uses Node.js fs.mkdirSync with the recursive option to ensure the full path exists.
 * @param   {string} filepath  The directory path to create.
 * @returns {void}
 */
export function mkdirpSync(filepath) {
    return fs.mkdirSync(filepath, { recursive: true });
}

/**
 * Copies a file to the output directory if it exists locally, or returns false if it's a URL.
 * This function is used to handle both local files and external URLs in template configuration.
 * Local files are copied to the specified output folder, while URLs are left untouched.
 * @param   {string}       filepath   The path to the file to copy (can be absolute, relative, or URL).
 * @param   {string}       outdir     The base output directory for the documentation.
 * @param   {string}       outfolder  The subfolder within the output directory where the file should be placed.
 * @returns {string|false}            The basename of the copied file if successful, or false if the file is a URL or doesn't exist.
 */
export function copyFile(filepath, outdir, outfolder) {
    // Resolve the absolute path of the provided custom CSS file
    const source = path.isAbsolute(filepath) ? filepath : path.resolve(process.cwd(), filepath),
          targetDir = path.join(outdir, outfolder),
          target = path.join(targetDir, path.basename(source)); // Build the target file path in the output directory

    // Only copy if the file exists locally
    if (fs.existsSync(source) && fs.statSync(source).isFile()) {
        mkdirpSync(targetDir); // Ensure the target directory exists
        fs.copyFileSync(source, target); // Copy the file from source to output
        return path.basename(source);
    }
    // If not a local file return 'false' to indicate that the file is not a local file
    return false;
}

/**
 * Finds doclets matching a given query specification using the template helper.
 * @param   {Object}        spec  The query object used to filter doclets.
 * @param   {Object}        data  Taffy  db instance.
 * @returns {Array<object>}       An array of matching doclets.
 */
export function find(spec, data) {
    return helper.find(data, spec);
}

/**
 * Generates an array of HTML links representing the ancestors of a given doclet.
 * Used to build a breadcrumb navigation for the documentation hierarchy.
 * @param   {Object}        doclet  The doclet for which to find ancestor links.
 * @param   {Object}        data    Taffy   db instance.
 * @returns {Array<string>}         An array of HTML link strings for each ancestor.
 */
export function getAncestorLinks(doclet, data) {
    return helper.getAncestorLinks(data, doclet);
}

/**
 * Converts a hash reference (e.g., '#method') to an HTML link for the given doclet.
 * If the input is not a valid hash, returns the original string.
 * @param   {Object} doclet  The doclet that contains the hash target.
 * @param   {string} hash    The hash fragment or reference string.
 * @returns {string}         An HTML anchor tag linking to the hash, or the original string if not a hash.
 */
export function hashToLink(doclet, hash) {

    if (!/^(#.+)/.test(hash)) return hash;

    let url;
    url = helper.createLink(doclet);
    url = url.replace(/(#.+|$)/, hash);

    return `<a href="${url}">${hash}</a>`;
}

/**
 * Creates a tutorial link with optional styling and prefix.
 * Generates an HTML link to a tutorial with customizable label and styling options.
 * @param   {Object} tutorial            The tutorial object containing name and other properties.
 * @param   {string} [label='Tutorial']  The label to display before the tutorial name.
 * @returns {string}                     The HTML link string for the tutorial.
 * @example
 * const link = tutoriallink(myTutorial, 'Guide');
 * // Returns: '<em class="disabled">Guide: tutorial-name</em>'
 */
export function tutoriallink(tutorial, label = 'Tutorial') {
    return helper.toTutorial(tutorial, null, {
        tag: 'em',
        classname: 'disabled',
        prefix: `${label}: `
    });
}

/**
 * Creates a tutorial link with a specific label.
 * Wrapper function that calls tutoriallink with a custom label.
 * @param   {string} label     The label to display before the tutorial name.
 * @param   {string} longName  The longname of the tutorial (unused in current implementation).
 * @param   {string} name      The tutorial name to link to.
 * @returns {string}           The HTML link string for the tutorial.
 */
function linktoTutorial(label, longName, name) {
    return tutoriallink(name, label);
}

/**
 * Returns an HTML link for an external longname, cleaning quotes from the name.
 * Uses the generic linkto helper to generate the link.
 * @param   {string} longName  The longname or URL of the external reference.
 * @param   {string} name      The display name for the link (quotes will be stripped).
 * @returns {string}           The HTML link string.
 */
export function linktoExternal(longName, name) {
    return linkto(longName, name.replace(/(^"|"$)/g, ''));
}

/**
 * Determines if the given doclet should display a signature in the documentation.
 * This includes functions, classes, typedefs that are functions, and namespaces implemented as functions.
 * @param   {Object}  doclet         The doclet to check.
 * @param   {string}  doclet.kind    The kind of the doclet (e.g., 'function', 'class', 'typedef', 'namespace').
 * @param   {Object}  [doclet.type]  The type property, may include a names array.
 * @param   {Object}  [doclet.meta]  The meta property, may include code information.
 * @returns {boolean}                True if a signature should be displayed, false otherwise.
 */
export function needsSignature({ kind, type, meta }) {
    let needsSig = false;

    // function and class definitions always get a signature
    if (kind === 'function' || kind === 'class' || kind === 'module') {
        needsSig = true;
    } else if (kind === 'typedef' && type?.names?.length) {
        // typedefs that contain functions get a signature, too
        for (let i = 0, l = type.names.length; i < l; i += 1) {
            if (type.names[i].toLowerCase() === 'function') {
                needsSig = true;
                break;
            }
        }
    } else if (kind === 'namespace' && meta?.code?.type?.match(/[Ff]unction/)) {
        // and namespaces that are functions get a signature (but finding them is a bit messy)
        needsSig = true;
    }

    return needsSig;
}

/**
 * Returns an array of signature attributes for a function parameter or property.
 * Recognizes 'opt' for optional, 'nullable' for nullable, and 'non-null' for non-nullable.
 * @param   {Object}        param             The parameter/property object (e.g., from doclet.params).
 * @param   {boolean}       [param.optional]  True if the parameter/property is optional.
 * @param   {boolean|null}  [param.nullable]  True if nullable, false if explicitly non-null, or undefined.
 * @returns {Array<string>}                   Array of signature attributes.
 */
export function getSignatureAttributes({ optional, nullable }) {

    const attributes = [];

    if (optional) attributes.push('opt');

    if (nullable === true) {
        attributes.push('nullable');
    } else if (nullable === false) {
        attributes.push('non-null');
    }

    return attributes;
}

/**
 * Returns the formatted HTML name for a parameter or property,
 * including signature attributes and variadic ("...") notation.
 * @param   {Object}  item             The parameter/property object.
 * @param   {string}  [item.name]      The name of the parameter/property.
 * @param   {boolean} [item.variable]  True if the parameter is variadic.
 * @returns {string}                   The formatted HTML string for this parameter/property name.
 */
export function updateItemName(item) {
    const attributes = getSignatureAttributes(item);
    let itemName = item.name || '';

    if (item.variable) itemName = `&hellip;${itemName}`;

    if (attributes && attributes.length) {
        itemName = `${itemName}<span class="signature-attributes">${attributes.join(', ')}</span>`;
    }

    return itemName;
}

/**
 * Formats parameter names for use in a function signature.
 * Only includes top-level parameters (excludes nested params, e.g. 'options.foo').
 * @param   {Array<object>} params  The array of parameter/property objects.
 * @returns {Array<string>}         Array of formatted parameter names (HTML).
 */
export function addParamAttributes(params) {
    return params.filter(({ name }) => name && !name.includes('.')).map(updateItemName);
}

/**
 * Builds an array of HTML type strings for a given parameter/property.
 * Each type is linked and HTML-escaped.
 * @param   {Object}        item         The parameter/property object.
 * @param   {Object}        [item.type]  The type info, expected to have a 'names' array.
 * @returns {Array<string>}              Array of type strings as HTML.
 */
export function buildItemTypeStrings(item) {
    const types = [];

    if (item && item.type && item.type.names) {
        item.type.names.forEach(name => {
            types.push(linkto(name, htmlsafe(name)));
        });
    }

    return types;
}

/**
 * Returns a string with HTML-formatted signature attributes.
 * Attributes will be wrapped in parentheses and escaped for HTML.
 * @param   {Array<string>} attribs  Array of attribute strings (e.g. ['opt', 'nullable']).
 * @returns {string}                 HTML string, e.g. "(opt, nullable) ".
 */
export function buildAttribsString(attribs) {
    let attribsString = '';
    if (attribs && attribs.length) attribsString = htmlsafe(`${attribs.join(', ')} `);
    return attribsString;
}

/**
 * Returns an array of HTML type strings for all items in the array.
 * Each type string is created via buildItemTypeStrings().
 * @param   {Array<object>} items  Array of parameter/property objects.
 * @returns {Array<string>}        Array of all type strings (HTML).
 */
export function addNonParamAttributes(items) {
    let types = [];
    items.forEach(item => { types = types.concat(buildItemTypeStrings(item)); });
    return types;
}

/**
 * Appends the function signature parameters to the signature string for the given doclet.
 * Modifies the doclet's .signature property in place.
 * @param {Object} f  The doclet object (typically a function or method).
 */
export function addSignatureParams(f) {
    const params = f.params ? addParamAttributes(f.params) : [];
    f.signature = `${f.signature || ''}(${params.join(', ')})`;
}

/**
 * Adds return or yield types and their attributes to the function signature string.
 * Updates the `.signature` property of the given doclet in place, to include type and attribute info.
 * @param {Object} f  The doclet object representing the function or method whose signature will be updated.
 */
export function addSignatureReturns(f) {
    const attribs = [];
    let attribsString = '';
    let returnTypes = [];
    let returnTypesString = '';
    const source = f.yields || f.returns;

    // jam all the return-type attributes into an array. this could create odd results (for example,
    // if there are both nullable and non-nullable return types), but let's assume that most people
    // who use multiple @return tags aren't using Closure Compiler type annotations, and vice-versa.
    if (source) {
        source.forEach(item => {
            helper.getAttribs(item).forEach(attrib => {
                if (!attribs.includes(attrib)) attribs.push(attrib);
            });
        });

        attribsString = buildAttribsString(attribs);
    }

    if (source) returnTypes = addNonParamAttributes(source);
    if (returnTypes.length) returnTypesString = ` &rarr; ${attribsString} ${returnTypes.join('|')}`;

    f.signature = `<span class="signature">${f.signature || ''}</span> <span class="return-signature">${returnTypesString}</span>`;
}

/**
 * Adds type information to the function signature string for the given doclet.
 * Updates the `.signature` property of the doclet in place, to include type info.
 * @param {Object} f  The doclet object representing the function, method, or property whose type will be appended.
 */
export function addSignatureTypes(f) {
    const types = f.type ? buildItemTypeStrings(f) : [];
    f.signature = `${f.signature || ''}<span class="type-signature">${types.length ? ` :${types.join('|')}` : ''}</span>`;
}

/**
 * Adds attribute information (e.g., nullable, optional) to the given doclet.
 * Sets the `.attribs` property on the doclet with the generated HTML.
 * @param {Object} f  The doclet object to update with attribute information.
 */
export function addAttribs(f) {
    const attribs = helper.getAttribs(f);
    const attribsString = buildAttribsString(attribs);
    f.attribs = `<span class="signature-attributes">${attribsString}</span>`;
}

/**
 * Shortens the resolved file paths in the files object by removing a common path prefix.
 * Always uses forward slashes for paths.
 * @param   {Object} files         An object mapping filenames to file data (with 'resolved' property).
 * @param   {string} commonPrefix  The prefix to remove from each resolved path.
 * @returns {Object}               The files object with added 'shortened' property on each file entry.
 */
export function shortenPaths(files, commonPrefix) {
    Object.keys(files).forEach(file => {
        files[file].shortened = files[file].resolved
            .replace(commonPrefix, '')
            .replace(/\\/g, '/'); // always use forward slashes
    });
    return files;
}

/**
 * Returns the file path for a doclet based on its meta information.
 * If no meta is present, returns null.
 * @param   {Object}      doclet         The doclet object, expected to have a 'meta' property.
 * @param   {Object}      [doclet.meta]  Meta information with 'path' and 'filename'.
 * @returns {string|null}                The resolved path string, or null if not available.
 */
export function getPathFromDoclet({ meta }) {
    if (!meta) return null;
    return meta.path && meta.path !== 'null' ? path.join(meta.path, meta.filename) : meta.filename;
}

/**
 * Converts a plain text (already stripped of HTML tags) to an SEO-friendly meta description.
 * Decodes HTML entities, normalizes whitespace, trims, and cuts to nearest sensible boundary.
 * @param   {string} text             The plain, tag-free input.
 * @param   {number} [maxLength=160]  Maximum description length.
 * @returns {string}                  SEO-friendly description.
 */
function toSeoDescription(text, maxLength = 160) {
    // Decode HTML entities (e.g. &amp;, &uuml;, &lt;, etc.)
    let desc = he.decode(text);
    // Normalize whitespace
    desc = desc.replace(/\s+/g, ' ').trim();
    // Remove JSDoc inline tags e.g. {@link ...}, {@code ...}, etc.
    desc = desc.replace(/\{@[\w]+[^}]*\}/g, '');
    // If too long, cut at last sentence or word boundary
    if (desc.length > maxLength) {
        let cut = desc.lastIndexOf('.', maxLength);
        if (cut < maxLength * 0.7) cut = desc.lastIndexOf(' ', maxLength);
        if (cut < 0) cut = maxLength;
        desc = `${desc.slice(0, cut).trim()}…`;
    }

    return desc;
}

/**
 * Generates an HTML documentation page for the given docs array and writes it to disk.
 * @param {string}        title         The page title.
 * @param {Array<object>} docs          Array of doclets or items to render.
 * @param {string}        filename      Output filename.
 * @param {boolean}       resolveLinks  Whether to resolve {\@link} tags to HTML links.
 * @param {string}        outdir        Output directory path.
 */
export function generate(title, docs, filename, resolveLinks, outdir) {
    let html;
    const resLinks = resolveLinks !== false,
          outpath = path.join(outdir, filename),
          needsAside = docs[0].kind !== 'source' && docs[1]?.kind !== 'mainpage',
          docData = {
              env,
              title,
              docs,
              aside: needsAside ? view.partial('sidebar.tmpl', { env, title, docs }) : ''
          };

    view.needsAside = needsAside;
    view.desc = toSeoDescription(striptags(docs[0].classdesc || docs[0].description || ''));

    html = view.render('container.tmpl', docData);

    if (resLinks) html = helper.resolveLinks(html); // turn {@link foo} into <a href="foodoc.html">foo</a>
    fs.writeFileSync(outpath, html, 'utf8');
}

/**
 * Generates pretty-printed HTML source files for all provided sourceFiles.
 * Registers links for source files and writes each as an HTML page.
 * @param {Object} sourceFiles  Mapping of source file info (with 'resolved' and 'shortened').
 * @param {string} encoding     File encoding to use (default 'utf8').
 * @param {string} outdir       Output directory for generated files.
 */
export function generateSourceFiles(sourceFiles, encoding, outdir) {
    const enc = encoding || 'utf8';

    Object.keys(sourceFiles).forEach(file => {
        let source;
        // links are keyed to the shortened path in each doclet's `meta.shortpath` property
        const sourceOutfile = helper.getUniqueFilename(sourceFiles[file].shortened);
        helper.registerLink(sourceFiles[file].shortened, sourceOutfile);

        try {
            source = {
                kind: 'source',
                code: helper.htmlsafe(fs.readFileSync(sourceFiles[file].resolved, enc))
            };
        } catch (e) {
            console.error(`Error while generating source file ${file}: ${e.message}`); // eslint-disable-line no-console
        }

        generate(`Source: ${sourceFiles[file].shortened}`, [source], sourceOutfile, false, outdir);

    });
}

/**
 * Look for classes or functions with the same name as modules (which indicates that the module
 * exports only that class or function), then attach the classes or functions to the `module`
 * property of the appropriate module doclets. The name of each class or function is also updated
 * for display purposes. This function mutates the original arrays.
 * @private
 * @param {Array.<module:@jsdoc/doclet.Doclet>} doclets  The array of classes and functions to check.
 * @param {Array.<module:@jsdoc/doclet.Doclet>} modules  The array of module doclets to search.
 */
export function attachModuleSymbols(doclets, modules) {
    const symbols = {};

    // build a lookup table
    doclets.forEach(symbol => {
        symbols[symbol.longname] = symbols[symbol.longname] || [];
        symbols[symbol.longname].push(symbol);
    });

    modules.forEach(module => {
        if (symbols[module.longname]) {
            module.modules = symbols[module.longname]
                // Only show symbols that have a description. Make an exception for classes, because
                // we want to show the constructor-signature heading no matter what.
                .filter(({ description, kind }) => description || kind === 'class')
                .map(symbol => {
                    const sym = _.cloneDeep(symbol);
                    if (sym.kind === 'class' || sym.kind === 'function') {
                        sym.name = `${sym.name.replace('module:', '(require("')}"))`;
                    }
                    return symbol;
                });
        }
    });
}

/**
 * Builds the navigation HTML for a set of documentation members (supports hierarchy).
 * @param   {Array<object>} items        Array of doclets/items to include in the navigation.
 * @param   {string}        itemHeading  The heading label for this section (top-level only).
 * @param   {Object}        itemsSeen    Object used to track which items have already been included (by longname).
 * @param   {Function}      linktoFn     Function to generate links for each item.
 * @returns {string}                     HTML string for the navigation section.
 */
export function buildMemberNav(items, itemHeading, itemsSeen, linktoFn) {
    let itemsNav = '';

    if (Array.isArray(items) && items.length) {
        items.forEach(item => {
            // Group heading, no longname
            if (!Object.hasOwn(item, 'longname')) {
                // Group headings only in top-level!
                if (item.name && item.children && item.children.length) {
                    itemsNav += `
                        <li class="has-submenu">
                            <span>${item.name}</span>
                            <button aria-expanded="false" aria-haspopup="true" class="nav-submenu-toggle"></button>
                            <div class="menu-wrapper" data-lenis-prevent>
                                <menu aria-hidden="true">
                                    ${buildMemberNav(item.children, '', itemsSeen, linktoFn)}
                                </menu>
                            </div>
                        </li>`;
                }
            } else if (!Object.hasOwn(itemsSeen, item.longname)) {

                const displayName = env.config.templates.default.useLongnameInNav ? item.longname : item.name;
                const hasChildren = Array.isArray(item.children) && item.children.length;

                let li = `<li${hasChildren ? ' class="has-submenu"' : ''}>`;
                li += linktoFn(item.longname, displayName.replace(/\b(module|event):/g, ''), null, null, true);

                if (hasChildren) {
                    li += `
                        <button aria-expanded="false" aria-haspopup="true" class="nav-submenu-toggle"></button>
                        <div class="menu-wrapper" data-lenis-prevent>
                            <menu aria-hidden="true">
                                ${buildMemberNav(item.children, '', itemsSeen, linktoFn)}
                            </menu>
                        </div>`;
                }
                li += '</li>';

                itemsNav += li;
                itemsSeen[item.longname] = true;
            }
        });
    }

    // Only top-level section gets the heading wrapper
    if (itemHeading && itemsNav) {
        return `
            <li class="has-submenu">
                <span>${itemHeading}</span>
                <button aria-expanded="false" aria-haspopup="true" class="nav-submenu-toggle"></button>
                <div class="menu-wrapper" data-lenis-prevent>
                    <menu aria-hidden="true">
                        ${itemsNav}
                    </menu>
                </div>
            </li>`;
    }

    return itemsNav;
}

/**
 * Builds the complete navigation HTML for the documentation site.
 * Iterates over all documentation member groups and generates navigation sections for each.
 * Handles "Globals" separately and ensures each unique item is only included once.
 * @param   {Object} members                      Object containing arrays of doclets/items, grouped by member type (modules, externals, namespaces, classes, interfaces, events, mixins, globals).
 * @param   {Object} [options]                    Additional options.
 * @param   {string} options.tutorialLabel        Custom label for "Tutorial".
 * @param   {string} options.tutorialLabelPlural  Custom label for "Tutorials" (plural form).
 * @param   {Array}  options.menuLinks            Array of external menu links to add to navigation.
 * @returns {string}                              Full navigation HTML as a string.
 */
export function buildNav(members, { tutorialLabel = 'Tutorial', tutorialLabelPlural = 'Tutorials', menuLinks = [] } = {}) {
    let globalNav;
    let nav = '<menu id="nav-main"><li><a href="index.html">Home</a></li>';
    const seen = {};
    const seenTutorials = {};

    nav += buildMemberNav(members.modules, 'Modules', {}, linkto);
    nav += buildMemberNav(members.externals, 'Externals', seen, linktoExternal);
    nav += buildMemberNav(members.namespaces, 'Namespaces', seen, linkto);
    nav += buildMemberNav(members.classes, 'Classes', seen, linkto);
    nav += buildMemberNav(members.interfaces, 'Interfaces', seen, linkto);
    nav += buildMemberNav(members.events, 'Events', seen, linkto);
    nav += buildMemberNav(members.mixins, 'Mixins', seen, linkto);

    if (members.globals.length) {

        globalNav = '';

        members.globals.forEach(({ kind, longname, name }) => {
            if (kind !== 'typedef' && !Object.hasOwn(seen, longname)) {
                globalNav += `<li>${linkto(longname, name)}</li>`;
            }
            seen[longname] = true;
        });

        if (globalNav) {
            nav += `<li class="has-submenu">
                <span>Global</span>
                <button aria-expanded="false" aria-haspopup="true" class="nav-submenu-toggle"></button>
                <div class="menu-wrapper"><menu>${globalNav}</menu></div>
            </li>`;
        } else {
            // turn the heading into a link so you can actually get to the global page
            nav += `<li>${linkto('global', 'Global')}</li>`;
        }
    }

    nav += buildMemberNav(members.tutorials, tutorialLabelPlural, seenTutorials, linktoTutorial.bind(null, tutorialLabel));

    // Add external menu links if provided
    if (Array.isArray(menuLinks) && menuLinks.length > 0) {
        menuLinks.forEach(link => {
            if (link.label && link.url) {
                nav += `<li><a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a></li>`;
            }
        });
    }

    nav += '</menu>';

    return nav;
}

/**
 * Resolves the destination path for a given source file, preserving its directory structure
 * relative to a parent directory, but mapping it into a different destination root.
 * @param   {string} parentDir   The parent directory (root of the original sources).
 * @param   {string} sourcePath  The absolute path of the source file.
 * @param   {string} destDir     The root directory for output/destination files.
 * @returns {string}             The absolute path where the file should be written.
 */
export function sourceToDestination(parentDir, sourcePath, destDir) {
    const relativeSource = path.relative(parentDir, sourcePath);
    return path.resolve(path.join(destDir, relativeSource));
}
