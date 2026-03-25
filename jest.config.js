module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/*.test.js', '**/*.spec.js'],
    moduleFileExtensions: ['js'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    verbose: true
};
