import { defineConfig } from 'vitest/config';

// Server-side test config. Node environment (no DOM needed) — everything
// under test is Express route/service/middleware logic plus pure utilities
// (PDF generation, ranking math). Prisma/Redis/Express are mocked per-test;
// see src/test/README.md for the mocking convention used across this suite.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/modules/**', 'src/middleware/**', 'src/utils/**'],
    },
  },
});
