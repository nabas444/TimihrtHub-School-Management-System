// ─────────────────────────────────────────────────────────────────────────────
// Static regression guard for the Session-4 authorization/tenancy fixes
// (Remaining-Work Plan v5, Section 4.4).
//
// Why static/AST-based instead of a runtime test: these route files import
// `express` and `@prisma/client` at module scope, so they cannot be
// `import`-ed or executed in any sandbox that lacks `node_modules` (true for
// every session on this project so far, including this one — see Section 2
// of the plan). Parsing the source with the TypeScript compiler API needs
// no dependency resolution at all, so this suite can actually run — and does
// run, right now, in this sandbox — instead of only being "ready to run
// later" like the Vitest suite alongside it.
//
// Each check locates a specific route registration by its path/method, then
// asserts a structural property of that one call expression. A regression
// (e.g. someone removes `authorize(...)` from /staff/payroll, or drops the
// schoolId filter from the library issue lookup) will fail the specific
// assertion for that route, not just "some route somewhere changed".
// ─────────────────────────────────────────────────────────────────────────────

import * as ts from 'typescript';
import * as fs from 'fs';

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

function loadSource(path: string): ts.SourceFile {
  const text = fs.readFileSync(path, 'utf8');
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

// Find `router.<method>('<path>', ...)` call expressions and return the
// full call expression text (printer-free — just the original source slice).
function findRouteCall(source: ts.SourceFile, method: string, routePath: string): string | null {
  const text = source.text;
  let found: string | null = null;

  function visit(node: ts.Node) {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === method &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'router'
    ) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg) && firstArg.text === routePath) {
        found = text.slice(node.getStart(source), node.getEnd());
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

function check(name: string, pass: boolean, detail?: string): CheckResult {
  return { name, pass, detail };
}

export function runChecks(serverSrcRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  // ── Behaviour: GET /student/:studentId/summary — IDOR fix ─────────────────
  {
    const src = loadSource(`${serverSrcRoot}/modules/behaviour/behaviour.routes.ts`);
    const call = findRouteCall(src, 'get', '/student/:studentId/summary');
    results.push(check(
      'behaviour: /student/:studentId/summary route exists',
      call !== null,
    ));
    if (call) {
      const hasSelfCheck = /req\.user\.role\s*===\s*Role\.STUDENT/.test(call) && /req\.user\.id\s*===\s*studentId/.test(call);
      const hasParentLinkCheck = /parentStudentLink\.findFirst/.test(call) && /Role\.PARENT/.test(call);
      const throws403WhenNoneMatch = /throw new AppError\([^)]*,\s*403\)/.test(call);
      results.push(check('behaviour: checks requester is self (student)', hasSelfCheck));
      results.push(check('behaviour: checks requester is a linked parent via ParentStudentLink', hasParentLinkCheck));
      results.push(check('behaviour: denies with 403 when none of staff/self/linked-parent match', throws403WhenNoneMatch));
    }
  }

  // ── Staff: GET /payroll and GET /leave — missing role-check fix ───────────
  {
    const src = loadSource(`${serverSrcRoot}/modules/staff/staff.routes.ts`);

    const payrollGet = findRouteCall(src, 'get', '/payroll');
    results.push(check('staff: GET /payroll route exists', payrollGet !== null));
    if (payrollGet) {
      const hasAuthorize = /authorize\(/.test(payrollGet.split(',')[1] ?? payrollGet);
      // authorize(...) must appear as a middleware arg, i.e. before the handler function
      const authorizeBeforeHandler = /authorize\([^)]*\)\s*,\s*async/.test(payrollGet);
      results.push(check('staff: GET /payroll is role-gated with authorize(...)', hasAuthorize && authorizeBeforeHandler));
    }

    const leaveGet = findRouteCall(src, 'get', '/leave');
    results.push(check('staff: GET /leave route exists', leaveGet !== null));
    if (leaveGet) {
      const authorizeBeforeHandler = /authorize\([^)]*\)\s*,\s*async/.test(leaveGet);
      results.push(check('staff: GET /leave is role-gated with authorize(...)', authorizeBeforeHandler));
    }

    // POST /payroll — cross-tenant teacherProfileId fix
    const payrollPost = findRouteCall(src, 'post', '/payroll');
    results.push(check('staff: POST /payroll route exists', payrollPost !== null));
    if (payrollPost) {
      const scopedLookup = /teacherProfile\.findFirst\(\{\s*where:\s*\{\s*id:\s*data\.teacherProfileId,\s*user:\s*\{\s*schoolId:\s*req\.user\.schoolId/.test(payrollPost.replace(/\s+/g, ' '));
      results.push(check('staff: POST /payroll verifies teacherProfileId belongs to requester\'s school', scopedLookup));
    }
  }

  // ── Library: issue/return tenancy-isolation fix ───────────────────────────
  // As of the session-6 testability refactor, this logic lives in the named
  // exported functions issueBook()/returnBook() rather than inline in the
  // route callback, so these checks look at the whole file rather than just
  // the router.post/.patch call expression text.
  {
    const src = loadSource(`${serverSrcRoot}/modules/library/library.routes.ts`);
    const flat = src.text.replace(/\s+/g, ' ');

    const issuePost = findRouteCall(src, 'post', '/:bookId/issue');
    results.push(check('library: POST /:bookId/issue route exists', issuePost !== null));
    if (issuePost) {
      const wiredToIssueBook = /issueBook\(/.test(issuePost) && /authorize\([^)]*\)\s*,\s*async/.test(issuePost);
      results.push(check('library: POST /:bookId/issue is role-gated and delegates to issueBook()', wiredToIssueBook));
    }
    const studentScoped = /studentProfile\.findFirst\(\{\s*where:\s*\{\s*id:\s*data\.studentProfileId,\s*user:\s*\{\s*schoolId/.test(flat);
    results.push(check('library: issueBook() verifies studentProfileId belongs to requester\'s school', studentScoped));

    const returnPatch = findRouteCall(src, 'patch', '/:bookId/return/:issueId');
    results.push(check('library: PATCH /:bookId/return/:issueId route exists', returnPatch !== null));
    if (returnPatch) {
      const wiredToReturnBook = /returnBook\(/.test(returnPatch) && /authorize\([^)]*\)\s*,\s*async/.test(returnPatch);
      results.push(check('library: PATCH /:bookId/return/:issueId is role-gated and delegates to returnBook()', wiredToReturnBook));
    }
    const bookSchoolScoped = /book:\s*\{\s*schoolId\s*\}/.test(flat) || /book:\s*\{\s*schoolId:\s*schoolId\s*\}/.test(flat);
    results.push(check('library: returnBook() verifies the book belongs to requester\'s school', bookSchoolScoped));
  }

  // ── Academics: session-2 grade-report classId regression ─────────────────
  {
    const src = loadSource(`${serverSrcRoot}/modules/academics/academics.service.ts`);
    const text = src.text;
    const guardPresent = /if\s*\(!student\.classId\)\s*throw new AppError/.test(text);
    results.push(check('academics: generateGradeReport rejects students with no assigned class', guardPresent));
  }

  return results;
}
