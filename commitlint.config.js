export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 中文 subject 含 PascalCase 组件名（如 MarkdownRenderer），关闭大小写校验
    'subject-case': [0],
    'subject-max-length': [2, 'always', 59],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
  },
}
