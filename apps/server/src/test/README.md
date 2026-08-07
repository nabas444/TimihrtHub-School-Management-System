# Server test suite — notes for whoever runs this first

This suite was written in a sandbox with **no npm/network access** (see
Section 2 of the Remaining-Work Plan). Two different kinds of tests live
here, verified two different ways:

## 1. Static/AST regression tests — `src/test/static/`

These parse route files as text with the TypeScript compiler API
(`ts.createSourceFile`) and assert structural properties (e.g. "the
`/staff/payroll` route's middleware list includes an `authorize(...)`
call"). They import nothing from the app itself — no `express`, no
`@prisma/client` — so they have **already been run for real** in the
authoring sandbox, and were confirmed to actually fail when the
session-4 bugs were artificially reintroduced into a scratch copy (not
a vacuous "always green" check). They'll also run fine under `npm test`
once Vitest is installed.

## 2. Runtime unit tests — everywhere else

These `vi.mock('../../config/database', ...)` and `vi.mock('../../config/redis', ...)`
to fake out Prisma/Redis, and construct minimal fake `Request`/`Response`
objects instead of pulling in `supertest`. They could **not** be executed
in the authoring sandbox — Express and `@prisma/client` aren't resolvable
without `npm install`, which has never succeeded here — so they were
verified by:
  - syntax-parsing every test file with the TS compiler (0 errors), and
  - manually tracing each assertion against the actual production code
    (not written from memory of what the code "should" do).

Treat these as **logically verified, not execution-verified**, exactly
per the "DONE (verified)" convention used elsewhere in this project.
Run `npm test` the moment a real `npm install` succeeds — that's the
very first thing to check once network access exists.

## Mocking convention used throughout

```ts
vi.mock('../../config/database', () => ({ db: mockDb }));
vi.mock('../../config/redis', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn(), cacheDel: vi.fn() }));
```

`mockDb` is a plain object literal with `vi.fn()` for whichever Prisma
methods the function under test actually calls — not a full
`vitest-mock-extended` deep mock, to avoid adding a dependency that
still needs a real `npm install` to prove out.
