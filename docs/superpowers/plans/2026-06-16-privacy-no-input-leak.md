# Privacy No-Input-Leak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `privacy-no-input-leak` golden fixture and an adversarial property-based test that proves draft text never surfaces in `stderr` or `metadata`.

**Architecture:** Refactor `runCli` to accept injectable IO streams and an optional analyzer so module-level tests can capture output and inject adversarial behavior without spawning subprocesses. The golden fixture runner gains a programmatic privacy assertion for `privacy-*` fixtures. A new property test exercises both the analyzer error path and the invalid-args path using `fast-check`.

**Tech Stack:** TypeScript, Node.js ESM, `fast-check` (new devDep), `tsx --test`, `node:test`

---

### Task 1: Refactor `src/cli/main.ts` to accept injectable IO and analyzer

**Files:**
- Modify: `src/cli/main.ts`

This makes the CLI testable at the module level. The entry point wires real process streams; the property test wires mock streams and adversarial analyzers.

- [ ] **Step 1.1: Verify baseline tests pass before touching anything**

```bash
nix develop --command pnpm test
```

Expected: all golden tests pass.

- [ ] **Step 1.2: Replace `main` with `runCli` accepting IO and optional injected analyzer**

Replace the full contents of `src/cli/main.ts` with:

```ts
#!/usr/bin/env node

import type { Readable } from "node:stream";
import { RepairExhaustedError } from "../analyzer/errors.js";
import { createFakeAnalyzer, createFakeRepairApi } from "../analyzer/fake.js";
import { RepairingAnalyzer } from "../analyzer/repairing.js";
import type { Analyzer } from "../analyzer/types.js";
import { formatJson } from "../output/format.js";
import { parseCliArgs } from "./args.js";
import { readStdin } from "./input.js";

export interface IO {
  stdin: Readable;
  stdout: { write(data: string): void };
  stderr: { write(data: string): void };
  setExitCode(code: number): void;
}

const maxDraftLength = 10_000;
const analyzerEnvName = "MESSAGE_MIRROR_ANALYZER";
const fakeScenarioEnvName = "MESSAGE_MIRROR_FAKE_SCENARIO";

void runCli(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  setExitCode: (code) => {
    process.exitCode = code;
  },
});

export async function runCli(
  args: string[],
  io: IO,
  injectAnalyzer?: Analyzer,
): Promise<void> {
  const calibrationResult = parseCliArgs(args);
  if (!calibrationResult.ok) {
    if (calibrationResult.kind === "stdout") {
      io.stdout.write(calibrationResult.message);
      return;
    }
    writeError(io, calibrationResult.message);
    return;
  }

  const draft = (await readStdin(io.stdin)).trim();
  if (draft.length === 0) {
    writeError(io, "error: draft message is empty");
    return;
  }

  if (draft.length > maxDraftLength) {
    writeError(io, "error: draft message exceeds 10000 characters");
    return;
  }

  const analyzer = injectAnalyzer ?? buildAnalyzer(io);
  if (analyzer === null) return;

  try {
    const output = await analyzer.analyze(draft, calibrationResult.calibration);
    io.stdout.write(formatJson(output));
  } catch (error) {
    if (error instanceof RepairExhaustedError) {
      writeError(
        io,
        `error: analyzer returned invalid schema after ${error.attempts} repair attempts`,
      );
    } else {
      writeError(io, "error: local analyzer backend unavailable");
    }
  }
}

function buildAnalyzer(io: IO): Analyzer | null {
  if (process.env[analyzerEnvName] !== "fake") {
    writeError(io, "error: local analyzer backend unavailable");
    return null;
  }
  const scenario = process.env[fakeScenarioEnvName];
  return new RepairingAnalyzer(createFakeAnalyzer(scenario), createFakeRepairApi(scenario));
}

function writeError(io: IO, message: string): void {
  io.stderr.write(`${message}\n`);
  io.setExitCode(1);
}
```

- [ ] **Step 1.3: Run tests to confirm refactor preserves behavior**

```bash
nix develop --command pnpm test
```

Expected: all golden tests pass.

- [ ] **Step 1.4: Run typecheck and lint**

```bash
nix develop --command pnpm run typecheck && nix develop --command pnpm run lint
```

Expected: no errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/cli/main.ts
git commit -m "Refactor runCli to accept injectable IO streams and analyzer"
```

---

### Task 2: Add the `privacy-no-input-leak` golden fixture

**Files:**
- Modify: `src/analyzer/fake.ts`
- Modify: `tests/cli.e2e.test.mjs`
- Create: `tests/golden/privacy-no-input-leak/stdin`
- Create: `tests/golden/privacy-no-input-leak/args`
- Create: `tests/golden/privacy-no-input-leak/stdout.json`

- [ ] **Step 2.1: Add the scenario to `src/analyzer/fake.ts`**

In the `scenarios` map, add one line after the existing `"success-multiline"` entry:

```ts
"privacy-no-input-leak": successfulApology,
```

So the map becomes:

```ts
const scenarios: Record<string, ScenarioFn> = {
  "success-calibrated": successfulApology,
  "success-unspecified": successfulApology,
  "success-multiline": successfulApology,
  "privacy-no-input-leak": successfulApology,
  "refusal-guilt-pressure": refusalGuiltPressure,
  "malformed-model-repaired": malformedInitialResponse,
  "malformed-model-exhausted": malformedInitialResponse,
  "malformed-model-plain-text-exhausted": malformedPlainTextResponse,
};
```

- [ ] **Step 2.2: Create fixture files**

Create `tests/golden/privacy-no-input-leak/stdin`:

```
PRIVACY SENTINEL: I cannot believe you did that to me.
```

Create `tests/golden/privacy-no-input-leak/args` (empty file — no calibration flags):

```
```

Create `tests/golden/privacy-no-input-leak/stdout.json` (identical shape to `success-unspecified/stdout.json` since no calibration flags are passed):

```json
{
  "schema_version": "message-mirror.v1",
  "ok": true,
  "metadata": {
    "input_source": "stdin",
    "privacy": {
      "local_only": true,
      "retained": false
    },
    "calibration": {
      "relationship": "unspecified",
      "goal": "unspecified",
      "desired_tone": "unspecified"
    }
  },
  "analysis": {
    "apparent_intent": "Apologize for a tense moment and reopen the conversation respectfully.",
    "emotional_tone": [
      "accountable",
      "warm"
    ],
    "possible_interpretations": [
      "The recipient may hear a clear apology without pressure to respond immediately."
    ],
    "risks_or_ambiguities": [],
    "hidden_needs_or_assumptions": []
  },
  "alternatives": [
    {
      "label": "direct",
      "text": "I am sorry I was short with you yesterday. That was unfair, and I will handle it differently next time.",
      "why": "Names the apology plainly and keeps responsibility with the sender."
    },
    {
      "label": "warm",
      "text": "I am sorry I was short with you yesterday. I care about our friendship and did not want to leave it there.",
      "why": "Adds care while preserving the apology."
    },
    {
      "label": "boundaried",
      "text": "I am sorry I was short with you yesterday. I wanted to acknowledge it, and there is no pressure to respond right away.",
      "why": "Offers repair while respecting the recipient's autonomy."
    }
  ]
}
```

- [ ] **Step 2.3: Extend `tests/cli.e2e.test.mjs` with a programmatic privacy assertion**

After the existing three `assert.equal` lines inside the test callback, add:

```js
if (goldenCase.name.startsWith("privacy-")) {
  const draft = goldenCase.stdin.trim();
  if (draft.length > 0) {
    assert.equal(
      result.stderr.includes(draft),
      false,
      "draft must not appear in stderr",
    );
    if (result.stdout.length > 0) {
      const parsed = JSON.parse(result.stdout);
      assert.equal(
        JSON.stringify(parsed.metadata ?? {}).includes(draft),
        false,
        "draft must not appear in metadata",
      );
    }
  }
}
```

The full test callback becomes:

```js
test(`golden fixture ${goldenCase.name}`, async () => {
  const result = await runCli({
    args: goldenCase.args,
    stdin: goldenCase.stdin,
    scenario: goldenCase.name,
  });

  assert.equal(result.exitCode, goldenCase.exitCode);
  assert.equal(result.stdout, goldenCase.stdout);
  assert.equal(result.stderr, goldenCase.stderr);

  if (goldenCase.name.startsWith("privacy-")) {
    const draft = goldenCase.stdin.trim();
    if (draft.length > 0) {
      assert.equal(
        result.stderr.includes(draft),
        false,
        "draft must not appear in stderr",
      );
      if (result.stdout.length > 0) {
        const parsed = JSON.parse(result.stdout);
        assert.equal(
          JSON.stringify(parsed.metadata ?? {}).includes(draft),
          false,
          "draft must not appear in metadata",
        );
      }
    }
  }
});
```

- [ ] **Step 2.4: Run tests — expect new fixture to pass**

```bash
nix develop --command pnpm test
```

Expected: all tests pass including `golden fixture privacy-no-input-leak`.

- [ ] **Step 2.5: Commit**

```bash
git add src/analyzer/fake.ts tests/cli.e2e.test.mjs \
  tests/golden/privacy-no-input-leak/stdin \
  tests/golden/privacy-no-input-leak/args \
  tests/golden/privacy-no-input-leak/stdout.json
git commit -m "Add privacy-no-input-leak golden fixture with programmatic metadata assertion"
```

---

### Task 3: Add adversarial property-based privacy test

**Files:**
- Modify: `package.json`
- Create: `tsconfig.test.json`
- Create: `tests/privacy.property.test.ts`

- [ ] **Step 3.1: Install `fast-check`**

```bash
nix develop --command pnpm add -D fast-check
```

Expected: `fast-check` appears in `devDependencies` in `package.json`.

- [ ] **Step 3.2: Add `test:property` script to `package.json`**

In the `"scripts"` block, add:

```json
"test:property": "tsx --test tests/privacy.property.test.ts"
```

- [ ] **Step 3.3: Add `tsconfig.test.json` so TypeScript covers test files**

Create `tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3.4: Run `tsc -p tsconfig.test.json --noEmit` to confirm it works (no test file yet)**

```bash
nix develop --command npx tsc -p tsconfig.test.json --noEmit
```

Expected: no errors (no `.ts` test files yet to check).

- [ ] **Step 3.5: Write `tests/privacy.property.test.ts`**

Create the file:

```ts
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import fc from "fast-check";
import { InvalidAnalyzerOutputError } from "../src/analyzer/errors.js";
import { RepairingAnalyzer } from "../src/analyzer/repairing.js";
import type { ModelRepairAPI } from "../src/analyzer/repairing.js";
import type { Analyzer } from "../src/analyzer/types.js";
import type { AnalyzerOutput } from "../src/output/schema.js";
import { type IO, runCli } from "../src/cli/main.js";

function makeIO(draft: string): { io: IO; stdout(): string; stderr(): string } {
  let out = "";
  let err = "";
  const io: IO = {
    stdin: Readable.from([draft]),
    stdout: { write: (s: string) => { out += s; } },
    stderr: { write: (s: string) => { err += s; } },
    setExitCode: (_code: number) => {},
  };
  return { io, stdout: () => out, stderr: () => err };
}

function assertNoDraftLeak(draft: string, stdout: string, stderr: string): void {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return;

  assert.equal(stderr.includes(trimmed), false, "draft must not appear in stderr");

  if (stdout.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return;
    }
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "metadata" in parsed
    ) {
      assert.equal(
        JSON.stringify((parsed as { metadata: unknown }).metadata).includes(trimmed),
        false,
        "draft must not appear in metadata",
      );
    }
  }
}

// Arbitrary non-empty draft text with a minimum length that makes the sentinel detectable.
const draftArb = fc.string({ minLength: 4, maxLength: 200 }).filter((s) => s.trim().length >= 4);

// Goal values that are definitely not in the allowed enum.
const invalidGoalArb = fc
  .string({ minLength: 1 })
  .filter((s) => !["apology","boundary","clarification","invitation","decline","feedback","repair","check_in","logistics","hard_conversation"].includes(s));

test("adversarial analyzer: Error(draft) does not appear in stderr", async () => {
  await fc.assert(
    fc.asyncProperty(draftArb, async (draft) => {
      const adversarial: Analyzer = {
        analyze: async (d: string): Promise<AnalyzerOutput> => {
          throw new Error(d);
        },
      };
      const { io, stdout, stderr } = makeIO(draft);
      await runCli([], io, new RepairingAnalyzer(adversarial, {
        repair: async () => '{"broken":true}',
      }));
      assertNoDraftLeak(draft, stdout(), stderr());
    }),
    { numRuns: 100 },
  );
});

test("adversarial analyzer: InvalidAnalyzerOutputError(draft) + schema-invalid repair does not leak draft", async () => {
  await fc.assert(
    fc.asyncProperty(draftArb, async (draft) => {
      const adversarial: Analyzer = {
        analyze: async (d: string): Promise<AnalyzerOutput> => {
          throw new InvalidAnalyzerOutputError(d);
        },
      };
      const repairApi: ModelRepairAPI = {
        repair: async () => '{"broken":true}',
      };
      const { io, stdout, stderr } = makeIO(draft);
      await runCli([], io, new RepairingAnalyzer(adversarial, repairApi));
      assertNoDraftLeak(draft, stdout(), stderr());
    }),
    { numRuns: 100 },
  );
});

test("adversarial analyzer: InvalidAnalyzerOutputError(draft) + plain-text repair does not leak draft", async () => {
  await fc.assert(
    fc.asyncProperty(draftArb, async (draft) => {
      const adversarial: Analyzer = {
        analyze: async (d: string): Promise<AnalyzerOutput> => {
          throw new InvalidAnalyzerOutputError(d);
        },
      };
      const repairApi: ModelRepairAPI = {
        repair: async (malformed: string) => malformed,
      };
      const { io, stdout, stderr } = makeIO(draft);
      await runCli([], io, new RepairingAnalyzer(adversarial, repairApi));
      assertNoDraftLeak(draft, stdout(), stderr());
    }),
    { numRuns: 100 },
  );
});

test("invalid args: draft does not appear in stderr even when args are rejected before stdin is read", async () => {
  await fc.assert(
    fc.asyncProperty(draftArb, invalidGoalArb, async (draft, invalidGoal) => {
      const { io, stdout, stderr } = makeIO(draft);
      await runCli(["--goal", invalidGoal], io);
      assertNoDraftLeak(draft, stdout(), stderr());
    }),
    { numRuns: 100 },
  );
});
```

- [ ] **Step 3.6: Type-check the test file**

```bash
nix develop --command npx tsc -p tsconfig.test.json --noEmit
```

Expected: no errors. If there are import path issues (e.g., `.js` extensions), fix them: Node ESM imports from `src/` require `.js` extensions even for `.ts` source files.

- [ ] **Step 3.7: Run the property tests**

```bash
nix develop --command pnpm run test:property
```

Expected: 4 tests pass, each having run 100 cases.

- [ ] **Step 3.8: Run full test suite**

```bash
nix develop --command pnpm test
```

Expected: all golden tests still pass.

- [ ] **Step 3.9: Run typecheck and lint**

```bash
nix develop --command pnpm run typecheck && nix develop --command pnpm run lint
```

Expected: no errors.

- [ ] **Step 3.10: Commit**

```bash
git add package.json tsconfig.test.json tests/privacy.property.test.ts
git commit -m "Add adversarial property-based privacy test using fast-check"
```
