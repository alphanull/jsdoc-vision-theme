import { nodeResolve } from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import fs from 'node:fs';
import path from 'node:path';

const { version } = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

export default {
    input: 'src/main.js',
    output: {
        file: `static/scripts/main.${version}.min.js`,
        format: 'iife',
        name: 'VisionTheme'
    },
    plugins: [
        nodeResolve(),
        esbuild({
            minify: true,
            target: 'es2018'
        })
    ]
};
