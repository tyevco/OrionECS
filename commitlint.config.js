module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // Match PR title check requirements
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci', 'perf', 'style', 'build'],
        ],
        // Subject must not start with uppercase (matches PR check)
        'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
        // Allow longer subject lines for detailed commits
        'subject-max-length': [2, 'always', 100],
        // Body line length
        'body-max-line-length': [2, 'always', 100],
        // Scope is optional
        'scope-empty': [0],
    },
};
