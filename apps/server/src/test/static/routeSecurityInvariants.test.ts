import { describe, it, expect } from 'vitest';
import { runChecks } from './routeSecurityInvariants';

// This suite is unusual: it doesn't mock anything and doesn't need Prisma or
// Express to be resolvable, because it never imports the route modules — it
// only parses their source text with the TypeScript compiler API. That's
// why it was possible to actually run this one for real in a sandbox with
// no node_modules at all (see src/test/README.md). Wrapped here as a normal
// Vitest suite so it also runs as part of `npm test` / CI once available.
describe('route security invariants (Section 4.4 regression guard)', () => {
  const results = runChecks(`${__dirname}/../..`);

  it.each(results.map((r) => [r.name, r] as const))('%s', (_name, result) => {
    expect(result.pass).toBe(true);
  });

  it('produced at least one check per fixed module (sanity — an empty suite would pass trivially)', () => {
    expect(results.length).toBeGreaterThanOrEqual(15);
  });
});
