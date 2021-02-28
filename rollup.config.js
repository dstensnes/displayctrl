import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from 'rollup-plugin-commonjs';
import vue from 'rollup-plugin-vue';

export default [
    {
        treeshake: true,
        input: 'frontend/viewer/index.js',
        output: [
            {
                file: 'public/viewer/viewer.js', // the name of our esm library
                format: 'esm', // the format of choice
                // sourcemap: true, // ask rollup to include sourcemaps
            },
        ],
        plugins: [
            replace({
                'process.env.NODE_ENV': JSON.stringify('production'),
                '__VUE_PROD_DEVTOOLS__': 'false',
                'preventAssignment': true,
            }),
            nodeResolve(),
            commonjs(),
            vue({
                target: 'browser',
                devtools: false,
                transformAssetUrls: false,
            }),
        ],
    },
];
