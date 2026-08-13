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
        document: 'readonly',
        window: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLSelectElement: 'readonly',
        MediaQueryList: 'readonly',
        MediaQueryListEvent: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        File: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        localStorage: 'readonly',
        confirm: 'readonly',
        getComputedStyle: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
      },
    },
    rules: {
      'vue/no-v-html': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['packages/docs/.vitepress/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        window: 'readonly',
      },
    },
    rules: {
      'vue/no-reserved-component-names': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.vitepress/cache/**',
      '**/*.d.ts',
    ],
  },
)
