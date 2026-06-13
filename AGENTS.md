# Agent Instructions

This repository uses spec-driven development.

The product specification is the source of truth:

```text
docs/specs/message-mirror-v1.md
```

`AGENTS.md` describes how to work in this repository. It should not duplicate the
product spec.

## Decision hierarchy

When instructions conflict, use this priority order:

1. The user's explicit request in the current task
2. `docs/specs/message-mirror-v1.md`
3. Machine-checkable contracts, especially JSON Schema and golden fixtures
4. This `AGENTS.md`
5. Existing implementation patterns
6. Agent preference or convenience

Do not resolve conflicts silently. If a lower-priority source disagrees with a
higher-priority source, follow the higher-priority source and mention the
discrepancy.

## Project boundary

`message-mirror` is a local-first CLI for analyzing one draft message from stdin.

For exact product behavior, CLI rules, schema requirements, privacy guarantees,
backend behavior, refusal behavior, repair behavior, tests, and acceptance
criteria, read:

```text
docs/specs/message-mirror-v1.md
```

Do not implement behavior outside the current spec unless the user explicitly
asks to update the spec first.

## Development workflow

Before implementing non-trivial behavior:

1. Read the relevant section of `docs/specs/message-mirror-v1.md`.
2. Identify the exact behavior being implemented.
3. Add or update tests that encode the behavior.
4. Implement the smallest change that satisfies the tests.
5. Keep the implementation aligned with the spec.

If the spec and implementation disagree, update the spec deliberately before
changing behavior.

Do not silently expand scope.

Before finishing a task:

* run relevant tests or explain why they were not run
* run typecheck when TypeScript changed
* inspect the diff
* confirm no product behavior drifted from the spec
* confirm no private input, prompt text, or raw model output is logged or exposed
* summarize changed files, validation, and remaining risks

## Superpowers plugin

When available, use the `superpowers` plugin to support disciplined
development workflows.

Use it for:

* clarifying the task before implementation
* checking whether a relevant skill or workflow exists
* following spec-driven or test-driven development practices
* planning small vertical slices
* reviewing changes before final response
* avoiding silent scope expansion

Prefer `superpowers` workflows when they help with the current task, especially
for non-trivial implementation, refactoring, testing, or design work.

Do not use the plugin as a substitute for reading the product spec.

The product spec remains authoritative:

```text
docs/specs/message-mirror-v1.md
```

If a `superpowers` workflow conflicts with the spec, follow the spec and mention
the discrepancy.

If the plugin is unavailable, continue using the same principles manually:

* read the relevant spec section
* identify the smallest coherent change
* write or update tests first
* implement the smallest passing change
* inspect the diff
* run validation
* summarize results and remaining risks

Do not let plugin-driven workflows expand scope, add speculative abstractions, or
delay a small obvious change.


## Tech stack

Use:

* TypeScript
* Node.js
* Zod
* JSON Schema
* Nix flakes
* pinned dependencies
* Ollama-compatible local analyzer backend
* `llama3.1:8b` as the documented local model base
* custom system prompt for analyzer behavior

Prefer:

* ESM modules
* `pnpm`
* `corepack`
* `node:test`
* `node:assert/strict`
* `tsx` for TypeScript development
* `tsc --noEmit` for type checking
* plain `tsc` for builds unless bundling becomes necessary
* Biome for formatting and linting
* fixture-based golden tests
* explicit expected JSON over large opaque snapshots

Avoid heavy dependencies unless there is a clear spec-driven reason.

Prefer boring, inspectable tooling.

## Nix

Use Nix flakes for development environments, pinned system dependencies, and
running the whole program locally.

The repository should contain:

```text
flake.nix
flake.lock
```

The flake must provide all non-user-secret dependencies required to:

* enter the development shell
* install JavaScript dependencies
* run the CLI
* run tests
* run type checks
* run formatters and linters
* build the project
* run the local Ollama-compatible analyzer path, where practical

The dev shell should provide the expected versions of:

* Node.js
* package manager
* TypeScript tooling
* test tooling
* formatting and linting tools
* JSON Schema validation tooling
* Ollama-related tooling needed by the documented local workflow

A new contributor or agent should be able to start from a clean checkout and use
the project through documented `nix develop` commands without manually installing
tooling outside Nix, except for user-specific secrets or explicitly documented
host services.

Do not depend on ambient globally-installed tools when they can reasonably be
provided by the flake.

Do not update pinned dependencies casually. When updating dependencies, make that
change explicit and commit it separately when appropriate.

## Code readability

Optimize code for human readability and reviewability.

Prefer clear, boring, explicit code over clever or highly compressed code.

Code should make the product behavior easy to audit against the spec.

### Modules

Prefer vertical module splitting.

A module should own one coherent area of behavior and define the relevant:

* types
* public API
* validation
* private helpers
* local implementation details

Colocate types with the vertical module that owns them, unless the type is a
stable interface between modules.

Prefer focused modules such as:

```text
src/cli/calibration.ts
src/cli/input.ts
src/analyzer/ollama.ts
src/analyzer/fake.ts
src/output/schema.ts
src/output/format.ts
```

Avoid dumping grounds such as:

```text
src/types.ts
src/utils.ts
src/helpers.ts
src/constants.ts
```

Shared modules are allowed when the abstraction is genuinely cross-cutting and
stable.

Keep modules small. Prefer modules under 500 lines. If a module grows too large,
refactor it around domain concepts or behavior boundaries.

### Code locality

Place related code close together.

Within a module, prefer this order:

1. high-level public API
2. main orchestration functions
3. helpers close to the code that uses them
4. general helpers at the bottom

A reader should be able to start at the public function and walk downward through
the implementation without jumping across many files.

### Test locality

Test module names should mirror production module names.

Examples:

```text
src/cli/calibration.ts
test/cli/calibration.ts

src/analyzer/ollama.ts
test/analyzer/ollama.ts

src/output/schema.ts
test/output/schema.ts
```

Prefer module-level tests for local behavior and golden tests for full CLI
behavior.

Golden fixtures may live separately when the spec requires a fixture layout.

### Naming and control flow

Use names that describe domain meaning.

Prefer:

```text
parseCalibrationFlags
normalizeMissingCalibration
validateAnalyzerOutput
repairMalformedAnalyzerOutput
formatUsageError
```

Avoid vague names such as:

```text
processInput
handleData
doValidation
utils
helpers
manager
```

Rename as soon as intent shifts.

Prefer simple control flow, early returns for error cases, and named intermediate
values over dense chains or deeply nested conditionals.

### Types

Types are cheap.

Use types generously to make boundaries explicit and illegal states hard to
represent.

Separate distinct type domains:

* CLI input types
* normalized domain input types
* business logic types
* analyzer request/response types
* external model API request/response types
* JSON Schema output types
* internal result/error types
* test fixture scenario types

Do not reuse external API types as business logic types.

Do not let Ollama request/response shapes leak into analyzer or domain logic.

Do not let CLI parsing types leak into business logic.

Translate at boundaries.

Prefer discriminated unions and explicit result types over loosely-related
booleans.

Use `unknown` at untrusted boundaries, then validate or narrow. Avoid `any`
unless there is a narrow, documented reason.

### Effects and interfaces

Keep effects at the edges.

Core logic should be pure where practical. It should accept explicit inputs and
return explicit outputs instead of reading process state, environment variables,
stdin, stdout, stderr, filesystem, network, clocks, or randomness directly.

Push effects into small boundary modules.

Represent external dependencies with small, fixed, mockable interfaces.

Interfaces should describe what the application needs, not everything the
external system can do.

Example:

```ts
export interface ModelAPI {
  generate(request: ModelRequest): Promise<ModelResponse>;
}
```

For v1, provide only the local Ollama-compatible production implementation
required by the spec.

Tests may provide in-memory or fake implementations of the same interfaces.

Do not implement hosted backends, remote fallback behavior, or extra production
implementations unless the spec is updated.

Wire concrete implementations at the CLI boundary.

Avoid direct coupling from domain logic to:

* `fetch`
* Ollama request shapes
* Node streams
* `process.env`
* `console.log`
* `console.error`
* filesystem APIs
* clocks
* randomness

Use dependency injection through explicit function arguments or small context
objects.

Avoid module-level mutable state and singleton clients unless there is a clear
boundary and tests can replace the implementation.

### Boundaries

Keep distinct responsibilities separate:

* CLI argument parsing
* stdin reading
* input validation
* calibration normalization
* analyzer backend calls
* analyzer output validation
* repair attempts
* JSON formatting
* stderr error formatting

Do not let backend code know about terminal formatting.

Do not let CLI parsing code know about Ollama request details.

Do not make tests depend on private implementation details when behavior-level
testing is sufficient.

### Comments and documentation

Write concise, useful comments.

Document why a decision exists when the reason is not obvious.

Document implementation details only when the implementation is complex,
surprising, security-sensitive, or tied to a spec requirement.

Do not write comments that merely repeat the code.

Good example:

```ts
// Repair attempts must not receive the original draft. This preserves the v1
// privacy contract even when model output is malformed.
```

Bad example:

```ts
// Increment i by one.
i++;
```

## Defensive engineering

Write code as if future maintainers, tests, and malformed inputs are part of the
design environment.

Prefer simple, explicit, well-tested code that fails safely and early.

### Quality

Do not live with broken windows.

Fix bad designs, wrong decisions, confusing names, and poor code when you see
them.

If a fix is small and local, make it. If a fix is larger than the current task,
leave a clear note or propose a follow-up instead of silently working around it.

Do not pile new behavior on top of a broken abstraction.

### DRY and documentation

Apply DRY to knowledge, not incidental similarity.

Each product rule, schema rule, enum list, privacy guarantee, and CLI contract
should have one authoritative representation.

For product behavior, the authority is:

```text
docs/specs/message-mirror-v1.md
```

For machine validation, the authority is the versioned JSON Schema required by
the spec.

Avoid copying spec details into multiple files when those details can be derived,
imported, generated, validated, or referenced.

Do not enforce DRY so aggressively that simple code becomes abstract and hard to
read. Repetition is acceptable when it is local, obvious, and cheaper than the
abstraction.

Treat documentation as code: accurate, current, specific, close to the behavior
it explains, and changed together with behavior.

### Design

Prefer low coupling and high cohesion.

Keep unrelated behavior independent.

Use narrow, mockable interfaces at effect boundaries.

Assume decisions may change later, but do not implement speculative features
before the spec requires them.

Design the seam; do not build the unused implementation.

Refactor when the code starts pushing back.

Signals include:

* names no longer match behavior
* tests are hard to write
* private helpers need excessive setup
* unrelated concepts change together
* new behavior requires touching many unrelated files
* a module is growing beyond a coherent responsibility
* a boundary leaks external API details into business logic

Fix the root design problem instead of adding another workaround.

### Contracts and assumptions

Do not assume important behavior works. Prove it with tests, fixtures, boundary
cases, or a real local smoke test when appropriate.

If an assumption matters to the spec or privacy contract, encode it in a test.

Use explicit contracts at boundaries:

* TypeScript types
* discriminated unions
* Zod schemas
* JSON Schema
* narrow interfaces
* assertions for impossible states
* golden tests

Validate untrusted data at the boundary before using it.

Treat model output, environment variables, CLI args, stdin, filesystem contents,
and network responses as untrusted.

Fail early when continuing would produce misleading, unsafe, invalid, or
privacy-risky behavior.

Use deterministic non-sensitive errors instead of partial, malformed, or
spec-invalid output.

Assertions must not include private draft text, raw prompts, raw model output, or
other sensitive data.

### State and steps

Act locally.

Keep mutable state and open resources scoped as tightly as possible.

Avoid global data, singleton state, global caches, global mutable configuration,
and monkeypatched process state.

Make small, reviewable changes.

After each meaningful step, check feedback:

* run targeted tests
* run type checks
* inspect diffs
* compare behavior against the spec
* review generated JSON shape when relevant

Prefer small end-to-end slices that prove real behavior over large unfinished
frameworks.

## Testing

Use the golden-test strategy and fixture layout from:

```text
docs/specs/message-mirror-v1.md
```

Golden tests should use deterministic fake analyzer behavior.

Do not snapshot live model prose.

Do not weaken tests to fit an implementation. Fix the implementation or update
the spec deliberately.

Real backend smoke tests must remain optional unless the spec says otherwise.

Tests should read like executable examples of the spec.

Prefer descriptive test names such as:

```text
omitted calibration flags normalize to unspecified
invalid goal exits non-zero without reading analyzer
refusal output omits analysis and alternatives
repair attempts do not receive original draft
```

Prefer testing effectful logic through mockable interfaces rather than
monkeypatching globals, network calls, process state, or console output.

### Property-based testing

Use property-based tests to validate broad assumptions and invariants.

Example-based tests are good for specific scenarios. Property-based tests are
better for proving that important behavior holds across many possible inputs,
including cases the developer did not think to write by hand.

Prefer property-based tests for:

* parsers
* validators
* normalizers
* formatters
* schema-boundary code
* privacy invariants
* deterministic output rules
* repair-loop limits
* CLI argument handling
* error formatting

Good property-test targets include:

* trimming input never changes internal whitespace
* empty or whitespace-only input always fails as a usage error
* drafts at or below the length limit are accepted by input validation
* drafts above the length limit are rejected
* invalid calibration enum values never reach the analyzer
* omitted calibration values always normalize to `"unspecified"`
* successful JSON output always validates against the v1 JSON Schema
* refusal JSON output always validates against the v1 JSON Schema
* usage errors never write to stdout
* domain refusals never write to stderr
* internal errors never include the draft text
* repair attempts never receive the original draft
* repair attempts never exceed the maximum model-call count
* formatted JSON always ends with exactly one trailing newline
* formatted JSON uses deterministic key order
* no output path leaks raw prompts or raw model output

Use hand-written golden tests for exact required CLI examples and representative
behavior.

Use property-based tests for invariants that should hold across many inputs.

Do not replace readable example tests with obscure property tests. The best test
suite should contain both examples that explain intended behavior and properties
that defend broad invariants.

## Privacy

Private message contents are sensitive.

Follow the privacy contract in:

```text
docs/specs/message-mirror-v1.md
```

Do not add persistence, telemetry, analytics, default logs, crash dumps, hosted
model calls, or other data-retention behavior unless the spec is explicitly
updated first.

Do not expose draft text in errors, logs, metadata, test failure messages, or
debug output except where the spec explicitly permits message text in successful
alternatives.

Every new input path is another validation path.

Every new output path is another privacy-leak path.

Every new dependency is another maintenance and security surface.

Prefer the smallest design that satisfies the current spec.

## Worktrees

Agents should work in a custom Git worktree unless the user explicitly asks to
work in the current checkout.

Before making changes, inspect repository state:

```sh
git status --short
git branch --show-current
```

If the user has already provided or opened a custom worktree, use that worktree.

If no custom worktree has been provided, create one from the current branch using
a descriptive branch name.

Example:

```sh
git worktree add ../message-mirror-<task-name> -b agent/<task-name>
```

Use short, descriptive task names such as:

```text
agent/add-v1-schema
agent/add-golden-fixtures
agent/add-cli-validation
agent/add-ollama-backend
agent/add-repair-loop
```

Do not create a new worktree if the user explicitly says to work in the current
directory.

Do not overwrite, clean, reset, or delete the user's uncommitted work without
explicit permission.

Do not delete worktrees unless explicitly asked.

## Git commits

When asked to commit changes, use:

```text
.agents/skills/commit-changes/SKILL.md
```

That skill must use:

```text
.agents/skills/commit-message-style/SKILL.md
```

Do not stage or commit before the user approves the proposed commit split.

Approval of the commit split is approval to stage and commit the proposed
commits using messages generated according to `commit-message-style`.

Do not ask for separate approval of each commit message unless the user
explicitly requests message review before committing.

Never mention AI-agent assistance in commit messages.

Never push unless explicitly asked.

## Final responses

When finishing a task, summarize:

* what changed
* which files changed
* what validation was run
* what was not validated
* any remaining risks or follow-up work

Be explicit when tests were not run.

