/* eslint-disable max-lines-per-function, no-undef */

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
 * VisionPlayer custom JSDoc template.
 * This publish module implements the template output logic for modern, hybrid JSDoc use.
 * It supports both classic (CJS) and modern (ESM) JSDoc API contracts.
 * All template helpers, HTML rendering, and output structure logic are handled here.
 * Inline comments and all JSDoc blocks are written in English.
 * @module   publish
 * @requires lib/templateHelper
 * @requires lib/template
 * @requires lib/utils
 * @requires node:fs
 * @requires node:path
 * @requires node:url
 * @requires @jsdoc/salty
 * @requires fast-glob
 * @requires common-path-prefix
 * @requires striptags
 * @author   JSDoc Authors
 * @author   Frank Kudermann - alphanull.de (modifications)
 * @license  Apache-2.0
 * @see      https://github.com/alphanull/jsdoc-theme-vision
 */

import fs from 'node:fs'; // Node.js file system API
import path from 'node:path'; // Node.js path utilities
import salty from '@jsdoc/salty'; // Enhanced doclet handling (TaffyDB, helpers)
import glob from 'fast-glob'; // Fast file globbing utility for matching files
import commonPathPrefix from 'common-path-prefix'; // Computes the common path prefix for files
import { fileURLToPath } from 'node:url'; // Converts file URL to local file path
import striptags from 'striptags';

import { Template } from './lib/template.js'; // Template rendering engine
import * as helper from './lib/templateHelper.js'; // All template helper utilities
import * as utils from './lib/utils.js';

// Shorthand references for common template helpers
const { htmlsafe, linkto, resolveAuthorLinks } = helper;
const { taffy } = salty; // TaffyDB doclet querying

// Compute __dirname in ESM (not available by default)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Maps tutorial longnames to their HTML output filenames.
 * @type {Object}
 */
const tutorialMap = {};

// Module-level (global) variables for the template workflow
let data; // TaffyDB doclet collection (queryable)
let view; // Template rendering context (populated later)

// Patch env to ensure modern config/options structure for hybrid Classic/ESM JSDoc support
env.config = env.conf;
env.options = env.opts;
const { config } = env;

/**
 * Returns the absolute file path to the README file as used by JSDoc.
 * If env.opts.readme is set, returns that (resolved); otherwise, searches in env.source.include.
 * @returns {string|undefined} The absolute README file path, or undefined if not found.
 */
function getReadmePath() {
    let file;
    if (typeof config.opts.readme === 'string' && config.opts.readme.trim().length) {
        file = path.resolve(process.cwd(), config.opts.readme);
        if (fs.existsSync(file) && fs.statSync(file).isFile()) return path.dirname(file);
    }
    if (config.source.include && Array.isArray(config.source.include)) {
        const mdFiles = config.source.include.filter(f => /\.md$/i.test(f));
        if (mdFiles.length) {
            file = path.resolve(process.cwd(), mdFiles[mdFiles.length - 1]);
            if (fs.existsSync(file) && fs.statSync(file).isFile()) return path.dirname(file);
        }
    }
}

/**
 * Recursively searches for a file by name within a directory tree.
 * Returns the absolute path if found, or null otherwise.
 * @param   {string}      dir         Directory to search within.
 * @param   {string}      targetName  File name to look for (with extension).
 * @returns {string|null}             Absolute path to the found file, or null.
 */
function findFileRecursive(dir, targetName) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = findFileRecursive(entryPath, targetName);
            if (found) return found;
        } else if (entry.isFile() && entry.name === targetName) {
            return entryPath;
        }
    }
    return null;
}

/**
 * Copies all local images referenced in the HTML string to the output directory,
 * searching the entire project root for each image, and updates their paths in the HTML.
 * @param   {string} html         The HTML string to process.
 * @param   {string} projectRoot  The absolute path to your project root directory.
 * @param   {string} outdir       The output directory (e.g., docs output root).
 * @returns {string}              The processed HTML with updated image paths.
 */
function processImagesInHtml(html, projectRoot, outdir) {
    const IMAGE_OUTPUT_DIR = path.join(outdir, 'images');

    // Ensure output directory exists
    if (!fs.existsSync(IMAGE_OUTPUT_DIR)) fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });

    return html.replace(/<img\b[^>]*\bsrc=['"]([^'"]+)['"][^>]*>/gi, (match, src) => {
        // Skip external URLs and data URIs
        if (/^(https?:|\/|data:)/i.test(src)) return match;

        const targetName = path.basename(src);
        const foundPath = findFileRecursive(projectRoot, targetName);

        if (!foundPath) {
            console.warn(`[WARN] Image not found in project: ${targetName}`); // eslint-disable-line no-console
            return match;
        }

        // Copy to images/ subfolder in output
        const destPath = path.join(IMAGE_OUTPUT_DIR, targetName);
        fs.copyFileSync(foundPath, destPath);

        // Update image src path in HTML
        const newSrc = `images/${targetName}`;
        return match.replace(src, newSrc);
    });
}

/**
 * Rewrites HTML links in tutorial - or readme - HTML that point to known tutorials inside the tutorial directory.
 * @param   {string} html         The HTML string (already rendered).
 * @param   {string} sourceDir    Absolute path of source file (tutorial or README).
 * @param   {string} tutorialDir  Absolute path of the tutorial root directory.
 * @returns {string}              HTML with rewritten links to tutorials.
 */
function linkifyTutorialContent(html, sourceDir, tutorialDir) {
    return html.replace(/<a\s+href=["']([^"']+\.md)["']>(.*?)<\/a>/gi, (match, hrefValue, text) => {

        const targetName = path.basename(hrefValue),
              foundPath = findFileRecursive(process.cwd(), targetName);

        if (!foundPath) {
            // eslint-disable-next-line no-console
            console.warn(`[WARN] Tutorial file not found: ${targetName}`);
            return text; // Remove link, keep text
        }

        // Check if found file is in tutorial directory
        if (foundPath.startsWith(tutorialDir)) {
            const basename = path.basename(foundPath, '.md');
            const file = tutorialMap[basename];
            if (file) {
                return `<a href="${file}">${text}</a>`;
            }
        }

        // File found but not in tutorial dir or not in tutorialMap
        return text; // Remove link, keep text
    });
}

/**
 * Main entry point for the JSDoc Vision Theme.
 * This function is called by JSDoc to generate the entire documentation output.
 * @param {taffy}  taffyData  The TaffyDB database containing all parsed doclets.
 * @param {Object} opts       JSDoc options object (including output destination, encoding, etc.).
 * @param {Object} tutorials  Tutorials tree as provided by JSDoc.
 */
export function publish(taffyData, opts, tutorials) { // eslint-disable-line max-statements

    let outdir = path.normalize(opts.destination);
    if (!path.isAbsolute(outdir)) {
        outdir = path.resolve(process.cwd(), outdir);
    }

    const templateConfig = config.templates || {};
    templateConfig.default = templateConfig.default || {};

    const templatePath = __dirname;
    view = new Template(path.join(templatePath, 'tmpl'));

    helper.setEnv(env);
    utils.setView(view);

    const globalUrl = helper.getUniqueFilename('global', env);
    helper.registerLink('global', globalUrl);

    // set up templating
    view.layout = templateConfig.default.layoutFile ? path.resolve(templateConfig.default.layoutFile) : 'layout.tmpl';

    data = utils.makeQueryableTaffy(taffyData);
    data = helper.prune(data, env);

    if (templateConfig.sort) data.sort('longname, version, since');

    helper.addEventListeners(data);

    let sourceFiles = {};

    const sourceFilePaths = [];

    data().each(doclet => {

        let sourcePath;

        doclet.attribs = '';

        if (doclet.examples) {
            doclet.examples = doclet.examples.map(example => {
                const match = example.match(/^\s*<caption>([\s\S]+?)<\/caption>(\s*[\n\r])([\s\S]+)$/i);
                let caption, code;
                if (match) {
                    caption = match[1];
                    code = match[3];
                }
                return {
                    caption: caption || '',
                    code: code || example
                };
            });
        }

        if (doclet.see) {
            doclet.see.forEach((seeItem, i) => {
                doclet.see[i] = utils.hashToLink(doclet, seeItem, env);
            });
        }

        // build a list of source files
        if (doclet.meta) {
            sourcePath = utils.getPathFromDoclet(doclet);
            sourceFiles[sourcePath] = {
                resolved: sourcePath,
                shortened: null
            };
            if (!sourceFilePaths.includes(sourcePath)) sourceFilePaths.push(sourcePath);
        }
    });

    if (sourceFilePaths.length) {
        sourceFiles = utils.shortenPaths(sourceFiles, commonPathPrefix(sourceFilePaths));
    }

    // update outdir if necessary, then create outdir
    const packageInfo = (utils.find({ kind: 'package' }, data) || [])[0];

    if (packageInfo && packageInfo.name) {
        outdir = path.join(outdir, packageInfo.name, packageInfo.version || '');
    }
    utils.mkdirpSync(outdir);

    // read own package.json, extract version and add to view object
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    view.version = packageJson.version;

    // copy the template's static files to outdir
    const fromDir = path.join(templatePath, 'static');
    const staticFiles = glob.sync('**/*', {
        cwd: fromDir,
        onlyFiles: true
    });

    staticFiles.forEach(fileName => {
        const toPath = path.join(outdir, fileName);
        utils.mkdirpSync(path.dirname(toPath));
        fs.copyFileSync(path.join(fromDir, fileName), toPath);
    });

    // copy user-specified static files to outdir
    if (templateConfig.default.staticFiles) {
        // The canonical property name is `include`. We accept `paths` for backwards compatibility  with a bug in JSDoc 3.2.x.
        let staticFilePaths = templateConfig.default.staticFiles.include || templateConfig.default.staticFiles.paths || [];
        staticFilePaths = glob.sync(staticFilePaths, {
            absolute: true,
            onlyFiles: true
        });

        for (const filepath of staticFilePaths) {
            const userStaticFileOutputDir = utils.sourceToDestination(
                commonPathPrefix(staticFilePaths),
                filepath,
                `${outdir}/static`
            );
            utils.mkdirpSync(path.dirname(userStaticFileOutputDir));
            fs.copyFileSync(filepath, userStaticFileOutputDir);
        }
    }

    view.logo = { text: templateConfig.logoText === false ? '' : templateConfig.logoText || 'Documentation' };

    const canonicalBaseOption = typeof templateConfig.canonical === 'string'
        ? templateConfig.canonical.trim()
        : '';

    if (canonicalBaseOption) {
        view.canonicalBase = canonicalBaseOption;
        view.canonicalTrailingSlash = canonicalBaseOption.endsWith('/');
    } else {
        delete view.canonicalBase;
        delete view.canonicalTrailingSlash;
    }

    if (templateConfig.logo || templateConfig.logoDark) {
        const logoFile = utils.copyFile(templateConfig.logo || templateConfig.logoDark, outdir, 'images');
        view.logo.light = logoFile === false ? templateConfig.logo || templateConfig.logoDark : `images/${logoFile}`;
        const logoDarkFile = utils.copyFile(templateConfig.logoDark || templateConfig.logo, outdir, 'images');
        view.logo.dark = logoDarkFile === false ? templateConfig.logoDark || templateConfig.logo : `images/${logoDarkFile}`;
    }

    if (templateConfig.css) {
        const cssFile = utils.copyFile(templateConfig.css, outdir, 'styles');
        view.cssFile = cssFile === false ? templateConfig.css : `styles/${cssFile}`;
    }

    if (templateConfig.js) {
        const jsFile = utils.copyFile(templateConfig.js, outdir, 'styles');
        view.jsFile = jsFile === false ? templateConfig.js : `styles/${jsFile}`;
    }

    if (templateConfig.favicon) {
        const icoFile = utils.copyFile(templateConfig.favicon, outdir, 'static');
        let icoType;
        if (templateConfig.favicon.endsWith('.svg')) icoType = 'image/svg+xml';
        if (templateConfig.favicon.endsWith('.png')) icoType = 'image/png';
        if (templateConfig.favicon.endsWith('.ico')) icoType = 'image/x-icon';
        view.icoType = icoType;
        view.icoFile = icoFile === false ? templateConfig.favicon : `static/${path.basename(icoFile)}`;
    }

    data().each(doclet => {

        let docletPath;
        const url = helper.createLink(doclet, env);

        helper.registerLink(doclet.longname, url);

        // add a shortened version of the full path
        if (doclet.meta) {
            docletPath = utils.getPathFromDoclet(doclet);
            docletPath = sourceFiles[docletPath].shortened;
            if (docletPath) {
                doclet.meta.shortpath = docletPath;
            }
        }

        const url2 = helper.longnameToUrl[doclet.longname];

        if (url2.includes('#')) {
            doclet.id = helper.longnameToUrl[doclet.longname].split(/#/).pop();
        } else {
            doclet.id = doclet.name;
        }

        if (utils.needsSignature(doclet)) {
            utils.addSignatureParams(doclet);
            utils.addSignatureReturns(doclet);
            utils.addAttribs(doclet);
        }

        doclet.ancestors = utils.getAncestorLinks(doclet, data);

        if (doclet.kind === 'member') {
            utils.addSignatureTypes(doclet);
            utils.addAttribs(doclet);
        }

        if (doclet.kind === 'constant') {
            utils.addSignatureTypes(doclet);
            utils.addAttribs(doclet);
            doclet.kind = 'member';
        }
    });

    // output pretty-printed source files by default
    const outputSourceFiles = templateConfig.default && templateConfig.default.outputSourceFiles !== false;

    // once for all
    const members = helper.getMembers(data);

    // set up tutorials for helper
    helper.setTutorials(tutorials);
    members.tutorials = tutorials.children;

    // add template helpers
    view.find = function(spec) { return utils.find(spec, data); };
    view.linkto = linkto;
    view.resolveAuthorLinks = resolveAuthorLinks;
    view.htmlsafe = htmlsafe;
    view.outputSourceFiles = outputSourceFiles;
    view.tutoriallink = utils.tutoriallink;
    view.tutorialHeader = templateConfig.tutorialHeader !== false;
    view.tutorialPageNav = templateConfig.tutorialPageNav !== false;
    view.tutorialNav = templateConfig.tutorialNav !== false;
    view.hasPrivates = env.options.private;
    view.showPrivates = typeof templateConfig.showPrivates === 'undefined' ? true : templateConfig.showPrivates;
    view.title = templateConfig.title || '';
    const configDescription = typeof templateConfig.description === 'string'
        ? templateConfig.description.trim()
        : '';
    view.customDescription = configDescription || null;
    view.description = configDescription || 'This is the autogenerated JSDoc documentation.';
    view.showTitleOnHomepage = templateConfig.showTitleOnHomepage !== false;
    view.footer = templateConfig.footer;
    view.showSkinSelector = typeof templateConfig.showSkinSelector === 'undefined' ? true : templateConfig.showSkinSelector;
    view.showFontSelector = typeof templateConfig.showFontSelector === 'undefined' ? true : templateConfig.showFontSelector;
    view.fontFamily = templateConfig.fontFamily || 'fira';
    view.skin = templateConfig.skin || 'default';
    view.skins = {
        default: 'Default Skin',
        nordic: 'Nordic Skin',
        ocean: 'Ocean Skin',
        earth: 'Earth Skin',
        forest: 'Forest Skin',
        desert: 'Desert Skin',
        fire: 'Fire Skin',
        lavender: 'Lavender Skin',
        candy: 'Candy Skin',
        grayscale: 'Grayscale Skin'
    };

    view.fonts = {
        fira: 'Fira Font Pack',
        recursive: 'Recursive Font Pack',
        ubuntu: 'Ubuntu Font Pack',
        source: 'Source Font Pack',
        noto: 'Noto Font Pack'
    };

    // Check if provided skin is not in the predetermined list and add it if needed
    if (templateConfig.skin && !Object.prototype.hasOwnProperty.call(view.skins, templateConfig.skin)) {
        const skinLabel = templateConfig.skinLabel || `${templateConfig.skin.charAt(0).toUpperCase() + templateConfig.skin.slice(1)} Skin`;
        view.skins[templateConfig.skin] = skinLabel;
    }

    view.nav = utils.buildNav(members, {
        tutorialLabel: templateConfig.tutorialLabel,
        tutorialLabelPlural: templateConfig.tutorialLabelPlural,
        menuLinks: templateConfig.menuLinks
    });

    utils.attachModuleSymbols(utils.find({ longname: { left: 'module:' } }, data), members.modules);

    // generate the pretty-printed source files first so other pages can link to them
    if (outputSourceFiles) {
        utils.generateSourceFiles(sourceFiles, opts.encoding, outdir, data);
    }

    if (members.globals.length) {
        utils.generate('Global', [{ kind: 'globalobj' }], globalUrl, true, outdir);
    }

    // set up the lists that we'll use to generate pages
    const classes = taffy(members.classes),
          modules = taffy(members.modules),
          namespaces = taffy(members.namespaces),
          mixins = taffy(members.mixins),
          externals = taffy(members.externals),
          interfaces = taffy(members.interfaces);

    Object.keys(helper.longnameToUrl).forEach(longname => {

        const myClasses = helper.find(classes, { longname }, data),
              myExternals = helper.find(externals, { longname }, data),
              myInterfaces = helper.find(interfaces, { longname }, data),
              myMixins = helper.find(mixins, { longname }, data),
              myModules = helper.find(modules, { longname }, data),
              myNamespaces = helper.find(namespaces, { longname }, data);

        if (myModules.length) utils.generate(`Module: ${myModules[0].name}`, myModules, helper.longnameToUrl[longname], true, outdir);
        if (myClasses.length) utils.generate(`Class: ${myClasses[0].name}`, myClasses, helper.longnameToUrl[longname], true, outdir);
        if (myNamespaces.length) utils.generate(`Namespace: ${myNamespaces[0].name}`, myNamespaces, helper.longnameToUrl[longname], true, outdir);
        if (myMixins.length) utils.generate(`Mixin: ${myMixins[0].name}`, myMixins, helper.longnameToUrl[longname], true, outdir);
        if (myExternals.length) utils.generate(`External: ${myExternals[0].name}`, myExternals, helper.longnameToUrl[longname], true, outdir);
        if (myInterfaces.length) utils.generate(`Interface: ${myInterfaces[0].name}`, myInterfaces, helper.longnameToUrl[longname], true, outdir);

    });

    let tutorialDir;

    /**
     * Generates a documentation page for a tutorial.
     * Renders the tutorial content and writes the resulting HTML file.
     * @param {string} title     The title for the tutorial page.
     * @param {Object} tutorial  The tutorial node (JSDoc tutorial object).
     * @param {string} filename  Output filename (relative to output directory).
     */
    function generateTutorial(title, tutorial, filename) {
        let tutHtml = tutorial.parse();
        // try to preserve links within tutorial
        tutHtml = linkifyTutorialContent(tutHtml, tutorialDir, tutorialDir);

        const headingMatch = tutHtml.match(/<(h[1-3])[^>]*>(.*?)<\/\1>/i);
        const headingTitle = headingMatch && headingMatch[2]
            ? striptags(headingMatch[2]).replace(/\s+/g, ' ').trim()
            : '';
        const normalizedTitle = striptags(title || '').replace(/\s+/g, ' ').trim();
        const layoutTitle = headingTitle || normalizedTitle || tutorial.title || view.title || 'Tutorial';

        const tutorialPath = path.join(outdir, filename),
              tutorialData = {
                  title: layoutTitle,
                  header: tutorial.title,
                  content: tutHtml,
                  children: tutorial.children,
                  aside: ''
              };

        const previousShowPageTitle = view.showPageTitle;
        view.showPageTitle = false;
        view.pageTitleOverride = layoutTitle;
        view.desc = utils.buildTutorialDescription(tutorial.title, tutHtml);
        view.needsAside = false;

        utils.setCanonicalUrl(filename);
        let html = view.render('tutorial.tmpl', tutorialData);
        view.showPageTitle = previousShowPageTitle;
        view.pageTitleOverride = null;
        // yes, you can use {@link} in tutorials too!
        html = helper.resolveLinks(html); // turn {@link foo} into <a href="foodoc.html">foo</a>
        fs.writeFileSync(tutorialPath, html, 'utf8');
    }

    // tutorials can have only one parent so there is no risk for loops

    /**
     * Recursively generates documentation pages for all child tutorials.
     * Populates the global tutorialMap for cross-linking between tutorials.
     * @param {Object}        tutorialNode           The current tutorial node (may have children).
     * @param {string}        tutorialNode.longname  The longname of the tutorials node.
     * @param {string}        tutorialNode.name      The name of the tutorials node.
     * @param {string}        tutorialNode.title     The title of the tutorials node.
     * @param {Array<Object>} tutorialNode.children  Array of child tutorials.
     */
    function saveChildren(tutorialNode) {
        // Process all children
        (tutorialNode.children || []).forEach(child => {
            generateTutorial(`${templateConfig.tutorialLabel || 'Tutorial'}: ${child.title}`, child, helper.tutorialToUrl(child.name, env));
            saveChildren(child);
        });
    }

    if (env.opts.tutorials) {

        tutorialDir = path.resolve(process.cwd(), env.opts.tutorials);

        const mapChildren = tutorialNode => {
            (tutorialNode.children || []).forEach(child => {
                tutorialMap[child.longname] = helper.tutorialToUrl(child.name, env);
                mapChildren(child);
            });
        };

        mapChildren(tutorials);
        saveChildren(tutorials);

    }

    const readMeDir = getReadmePath();

    let processedReadMe = opts.readme;

    if (processedReadMe) {
        processedReadMe = processImagesInHtml(opts.readme, process.cwd(), outdir);
        processedReadMe = linkifyTutorialContent(processedReadMe, readMeDir, tutorialDir);
    }

    // index page displays information from package.json and lists files
    const indexUrl = helper.getUniqueFilename('index', env),
          files = utils.find({ kind: 'file' }, data),
          packages = utils.find({ kind: 'package' }, data);

    utils.generate(templateConfig.title || 'Home', packages.concat([{
        kind: 'mainpage',
        readme: processedReadMe,
        longname: opts.mainpagetitle ? opts.mainpagetitle : 'Main Page'
    }]).concat(files), indexUrl, true, outdir);

    // generate search index
    const dataDir = path.join(outdir, 'static'),
          indexPath = path.join(dataDir, 'index.json'),
          indexJsPath = path.join(dataDir, 'index.js'),
          searchIndex = data().get()
              .filter(doclet => !doclet.undocumented && !doclet.ignore && (doclet.name && doclet.meta && doclet.longname && doclet.kind !== 'package'))
              .map(doclet => ({
                  title: helper.shortenModuleLinkName(doclet.longname),
                  link: helper.createLink(doclet, env).replace('##', '#'),
                  description: striptags(doclet.classdesc || doclet.description || '')
              }));

    utils.mkdirpSync(dataDir);
    fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, 2), 'utf8');
    const indexJsContent = `window.__VISION_THEME_SEARCH_INDEX = ${JSON.stringify(searchIndex)};`;
    fs.writeFileSync(indexJsPath, indexJsContent, 'utf8');

}
