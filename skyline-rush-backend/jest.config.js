module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['apps/**/*.(t|j)s', 'libs/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@libs/db/(.*)$': '<rootDir>/libs/db/$1',
    '^@libs/db$': '<rootDir>/libs/db/index',
    '^@libs/shared-types/(.*)$': '<rootDir>/libs/shared-types/$1',
    '^@libs/shared-types$': '<rootDir>/libs/shared-types/index',
    '^@libs/auth/(.*)$': '<rootDir>/libs/auth/$1',
    '^@libs/auth$': '<rootDir>/libs/auth/index',
    '^@libs/metrics/(.*)$': '<rootDir>/libs/metrics/$1',
    '^@libs/metrics$': '<rootDir>/libs/metrics/index',
    '^@apps/(.*)$': '<rootDir>/apps/$1'
  }
};
