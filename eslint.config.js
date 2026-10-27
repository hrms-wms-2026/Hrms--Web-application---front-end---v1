// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // `_`-prefixed names mark parameters that an interface or callback signature requires but the body ignores.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Existing outputs named like DOM events (close, change, ...) are public component API; renaming them
      // touches every parent template. Kept visible as warnings so new code avoids the pattern.
      '@angular-eslint/no-output-native': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Fire-and-forget cleanup (`.catch(() => {})`) and no-op callbacks are deliberate; empty methods are not.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      // Best-effort DOM calls (execCommand, selection APIs) may throw in some browsers and are safe to ignore.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Test doubles routinely stub with `any` and no-op functions.
    files: ['**/*.spec.ts', 'src/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // `x != null` is the idiomatic "neither null nor undefined" check.
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      // Accessibility backlog (keyboard support on clickable non-button elements). Visible as warnings
      // and tracked in docs/reports/code-quality/; new templates should use <button> or add key handlers.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
      '@angular-eslint/template/no-autofocus': 'warn',
    },
  },
]);
