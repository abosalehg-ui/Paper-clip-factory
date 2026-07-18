import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: globals.browser,
        },
    },
    {
        files: ['service-worker.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'script',
            globals: globals.serviceworker,
        },
    },
    {
        files: ['test/**/*.js', 'tools/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.browser },
        },
    },
    {
        rules: {
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        ignores: ['node_modules/'],
    },
];
