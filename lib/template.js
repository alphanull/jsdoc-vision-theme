/*
  Copyright 2012 the JSDoc Authors.
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

import fs from 'node:fs';
import path from 'node:path';
import _ from 'lodash';

/**
 * Template helper.
 * @exports module:lib/template
 * @class
 */
export class Template {
    /**
     * Constructs a new Template.
     * @param {string} filepath  Templates directory.
     */
    constructor(filepath) {
        this.path = filepath;
        this.layout = null;
        this.cache = {};
        // override default template tag settings
        this.settings = {
            evaluate: /<\?js([\s\S]+?)\?>/g,
            interpolate: /<\?js=([\s\S]+?)\?>/g,
            escape: /<\?js~([\s\S]+?)\?>/g
        };
    }

    /**
     * Loads template from given file.
     * @param   {string}   file  Template filename.
     * @returns {Function}       Returns template closure.
     */
    load(file) {
        return _.template(fs.readFileSync(file, 'utf8'), this.settings);
    }

    /**
     * Renders template using given data.
     *
     * This is low-level function, for rendering full templates use {@link Template.render()}.
     * @param   {string} file  Template filename.
     * @param   {Object} data  Template variables.
     * @returns {string}       Rendered template.
     */
    partial(file, data) {

        const filePath = path.resolve(this.path, file);

        // load template into cache
        if (!(filePath in this.cache)) this.cache[filePath] = this.load(filePath);

        // keep template helper context
        return this.cache[filePath].call(this, data);
    }

    /**
     * Renders template with given data.
     *
     * This method automaticaly applies layout if set.
     * @param   {string} file  Template filename.
     * @param   {Object} data  Template variables.
     * @returns {string}       Rendered template.
     */
    render(file, data) {
        // main content
        let content = this.partial(file, data);

        // apply layout
        if (this.layout) {
            data.content = content;
            content = this.partial(this.layout, data);
        }

        return content;
    }
}
