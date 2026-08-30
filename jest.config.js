/**
 * Two Jest projects, because the two lower test layers want different worlds:
 *
 *  - `logic`  : plain Node. Domain rules and the API client under MSW. Fast,
 *               no React, no native mocks, real fetch + real HTTP interception.
 *  - `native` : jest-expo. Components, hooks, screens through React Native
 *               Testing Library.
 *
 * `npm test` runs both; `npm test -- --selectProjects logic` runs just the fast one.
 */
module.exports = {
  projects: [
    {
      displayName: 'logic',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/domain/**/*.test.ts', '<rootDir>/src/api/**/*.test.ts'],
      transform: {
        '^.+\\.m?[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      // MSW v2 pulls in a handful of ESM-only packages that Jest must transpile.
      transformIgnorePatterns: [
        '/node_modules/(?!(msw|@mswjs|@bundled-es-modules|@open-draft|until-async|outvariant|strict-event-emitter|is-node-process|headers-polyfill|rettime|graphql|tough-cookie|psl)/)',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json'],
      setupFilesAfterEnv: ['<rootDir>/src/test/setup-msw.ts'],
    },
    {
      displayName: 'native',
      preset: 'jest-expo',
      testMatch: [
        '<rootDir>/src/components/**/*.test.tsx',
        '<rootDir>/src/screens/**/*.test.tsx',
        '<rootDir>/src/state/**/*.test.ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/test/setup-native.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
      ],
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/test/**', '!src/**/*.test.{ts,tsx}'],
};
