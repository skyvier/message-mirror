# Privacy No-Input-Leak Design

**Date:** 2026-06-16
**Scope:** Complete the minimum golden suite with `privacy-no-input-leak` and add an adversarial property-based test for the privacy invariant.

## What we're building

Two things:

1. A `privacy-no-input-leak` golden fixture that explicitly asserts the draft text does not appear in `metadata` or `stderr`.
2. An adversarial property-based test that generates arbitrary draft text, passes it to analyzers that deliberately try to echo it back in error paths, and asserts the draft never surfaces in `stderr` or `metadata`.

## Privacy scope

Option 2 (from design discussion): protect `stderr` and stdout `metadata`. Analysis fields and `refusal.reason`/`refusal.safer_frame` are model-authored prose and are out of scope for content filtering. No runtime sanitization of analyzer output content is needed.

## Changes

### 1. Refactor `src/cli/main.ts` — inject IO and analyzer

Add an `IO` interface:

```ts
interface IO {
  stdout: { write(data: string): void };
  stderr: { write(data: string): void };
}
```

Change the exported entry point to:

```ts
void runCli(process);

async function runCli(io: IO, injectAnalyzer?: Analyzer): Promise<void>
```

When `injectAnalyzer` is provided, use it instead of building the analyzer from env vars. The production entry point continues to pass `process` and no injected analyzer, so behavior is unchanged.

### 2. Extend `tests/cli.e2e.test.mjs` — programmatic privacy assertion

For every fixture whose name starts with `privacy-`, after the exact-match assertions, add:

```js
if (goldenCase.name.startsWith("privacy-")) {
  const draft = goldenCase.stdin.trim();
  if (draft.length > 0) {
    assert.equal(result.stderr.includes(draft), false, "draft must not appear in stderr");
    if (result.stdout) {
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

### 3. Add `tests/golden/privacy-no-input-leak/` fixture

- `stdin`: `PRIVACY SENTINEL: I cannot believe you did that to me.`
- `args`: (empty — no calibration flags)
- `stdout.json`: success output with all calibration values `unspecified` (same shape as `success-unspecified`)

Add `"privacy-no-input-leak": successfulApology` to the scenarios map in `src/analyzer/fake.ts`.

### 4. New `tests/privacy.property.test.ts`

Uses `fast-check` (new devDep) and `tsx` (already a devDep) to run.

New `test:property` script in `package.json`:

```json
"test:property": "pnpm build && tsx --test tests/privacy.property.test.ts"
```

**Generators:**
- Draft text: `fc.string({ minLength: 4 })` — ensures there is a non-trivial sentinel to search for
- Adversarial analyzer variant: `fc.oneof(...)` over four behaviors (see below)
- Calibration: arbitrary valid calibration (all unspecified is fine; the property is about error handling, not calibration)

**Three adversarial analyzer behaviors:**

| Variant | Analyzer throws | Repair behavior |
|---------|----------------|-----------------|
| 1 | `throw new Error(draft)` | no repair called (throws before returning) |
| 2 | `throw new InvalidAnalyzerOutputError(draft)` | repair always returns `'{"broken":true}'` (schema-invalid JSON) → exhaustion |
| 3 | `throw new InvalidAnalyzerOutputError(draft)` | repair always returns draft as plain text (not JSON) → exhaustion |

All four variants follow the same assertion:

```ts
assert.equal(capturedStderr.includes(draft.trim()), false);
if (capturedStdout) {
  const parsed = JSON.parse(capturedStdout);
  assert.equal(JSON.stringify(parsed.metadata ?? {}).includes(draft.trim()), false);
}
```

**Capture mechanism:** Pass a mock `IO` to `runCli`:

```ts
let capturedStdout = "";
let capturedStderr = "";
const io = {
  stdout: { write: (s: string) => { capturedStdout += s; } },
  stderr: { write: (s: string) => { capturedStderr += s; } },
};
await runCli(io, adversarialAnalyzer);
```

## Files changed

| File | Change |
|------|--------|
| `src/cli/main.ts` | Add `IO` interface; accept `io` and optional `injectAnalyzer`; replace `process.stdout`/`process.stderr` with `io.stdout`/`io.stderr` |
| `src/analyzer/fake.ts` | Add `"privacy-no-input-leak": successfulApology` to scenarios map |
| `tests/cli.e2e.test.mjs` | Add `privacy-*` programmatic assertion block |
| `tests/golden/privacy-no-input-leak/stdin` | New fixture file |
| `tests/golden/privacy-no-input-leak/args` | New fixture file |
| `tests/golden/privacy-no-input-leak/stdout.json` | New fixture file |
| `tests/privacy.property.test.ts` | New property test |
| `package.json` | Add `fast-check` devDep; add `test:property` script |

## What is not tested

- Analyzer returning schema-valid output with draft text in `analysis.*` fields — accepted behavior (model-authored prose).
- Analyzer returning draft text in `refusal.reason` — accepted behavior.
- CLI arg parsing producing draft leaks — impossible by construction (validation runs before stdin is read).
