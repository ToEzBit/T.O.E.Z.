import { defineConfig } from 'vitest/config'

// Two suites, per the spec's testing decisions:
//
//   unit        — the fast default suite. Pure orchestrator behaviour driven
//                 through the Session seam with fakes. No network, no binaries.
//   integration — provider contract tests (MiniMax, `say`, whisper). These need
//                 network or local models, so they are excluded from the
//                 default run and exercised on their own.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['{src,test}/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['{src,test}/**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
})
