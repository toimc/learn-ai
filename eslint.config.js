import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettierConfig,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: {
        HTMLElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        File: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
      },
    },
    rules: {
      'vue/no-v-html': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['packages/docs/.vitepress/**/*.{ts,vue}'],
    rules: {
      'vue/no-reserved-component-names': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
    ],
  },
)
