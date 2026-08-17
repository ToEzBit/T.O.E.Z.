import { defineConfig } from 'vitest/config'

// Two suites, per the spec's testing decisions:
//
//   unit        — the fast default suite. Mostly orchestrator behaviour driven
//                 through the Session seam with fakes; alongside it, the few
//                 checks that need neither — the Workspace against a temp
//                 directory, and ADR-0002's promise that no API key is anywhere
//                 in this repository. No network, no binaries, nothing mocked.
//   integration — provider contract tests: the Agent SDK Engine, whisper.cpp
//                 and MiniMax now; Apple's `say` when T11 adds it. These need
//                 network, a Claude login, a MiniMax key or local models, so
//                 they are excluded from the default run and exercised on
//                 their own.
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
