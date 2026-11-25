module.exports = {
  extends: ['next/core-web-vitals'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/lambda/**'],
          message: 'Import from skeleton instead of crossing app boundaries.',
        },
        {
          group: ['**/a11y/**'],
          message: 'Import from skeleton instead of crossing app boundaries.',
        },
      ],
    }],
  },
  overrides: [
    {
      files: ['src/app/lambda/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['**/a11y/**'],
        }],
      },
    },
    {
      files: ['src/app/a11y/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['**/lambda/**'],
        }],
      },
    },
  ],
};
