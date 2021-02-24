import commonjs from 'rollup-plugin-commonjs';
import VuePlugin from 'rollup-plugin-vue';

export default [
    {
        input: 'frontend/viewer/index.js',
        output: [
            {
                file: 'public/js/viewer.js', // the name of our esm library
                format: 'esm', // the format of choice
                sourcemap: true, // ask rollup to include sourcemaps
            },
        ],
        plugins: [
            commonjs(),
            VuePlugin(),
        ],
    },
];
