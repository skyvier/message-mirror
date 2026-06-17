# Ollama Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/analyzer/ollama.ts` so the CLI uses a real local Ollama backend by default instead of failing when `MESSAGE_MIRROR_ANALYZER` is not `"fake"`.

**Architecture:** A `ModelAPI` interface abstracts the Ollama HTTP transport. `OllamaAnalyzer` (implements `Analyzer`) and `OllamaRepairAPI` (implements `ModelRepairAPI`) both take a `ModelAPI` and are combined in `RepairingAnalyzer`. `buildAnalyzer()` in `run.ts` wires the real implementation when `MESSAGE_MIRROR_ANALYZER !== "fake"`.

**Tech Stack:** TypeScript, Node.js ESM, Zod v4 (`toJSONSchema`), `node:test`, `tsx`, `fetch` (built-in Node.js 18+)

---

### Task 1: Add `test:unit` script and update CI

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the script to `package.json`**

In `package.json`, add `"test:unit"` to the `scripts` block:

```json
"scripts": {
  "build": "tsc",
  "format:check": "biome check --vcs-enabled=true --vcs-client-kind=git --vcs-use-ignore-file=true --formatter-enabled=true --linter-enabled=false --assist-enabled=false --no-errors-on-unmatched .",
  "lint": "biome lint --vcs-enabled=true --vcs-client-kind=git --vcs-use-ignore-file=true --no-errors-on-unmatched .",
  "test": "pnpm build && node --test tests/*.test.mjs",
  "test:property": "tsx --test tests/privacy.property.test.ts",
  "test:unit": "tsx --test tests/analyzer/ollama.test.ts",
  "typecheck": "tsc --noEmit",
  "typecheck:test": "tsc -p tsconfig.test.json --noEmit",
  "generate:schema": "tsx scripts/generate-schema.ts && biome format --write schema/message-mirror.v1.schema.json"
}
```

- [ ] **Step 2: Add unit test step to CI**

In `.github/workflows/ci.yml`, find the `test` job. After the `Property tests` step, add:

```yaml
      - name: Unit tests
        run: nix develop --command pnpm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "Add test:unit script and CI step for analyzer unit tests"
```

---

### Task 2: Write failing tests for `OllamaAnalyzer` and `OllamaRepairAPI`

**Files:**
- Create: `tests/analyzer/ollama.test.ts`

- [ ] **Step 1: Create `tests/analyzer/` and write the test file**

```typescript
// tests/analyzer/ollama.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidAnalyzerOutputError } from "../../src/analyzer/errors.js";
import { OllamaAnalyzer, OllamaRepairAPI, type ModelAPI } from "../../src/analyzer/ollama.js";
import type { Calibration } from "../../src/cli/calibration.js";

const unspecified: Calibration = {
	relationship: "unspecified",
	goal: "unspecified",
	desired_tone: "unspecified",
};

const validSuccessJson = JSON.stringify({
	schema_version: "message-mirror.v1",
	ok: true,
	metadata: {
		input_source: "stdin",
		privacy: { local_only: true, retained: false },
		calibration: { relationship: "unspecified", goal: "unspecified", desired_tone: "unspecified" },
	},
	analysis: {
		apparent_intent: "Test intent.",
		emotional_tone: ["neutral"],
		possible_interpretations: ["Test interpretation."],
		risks_or_ambiguities: [],
		hidden_needs_or_assumptions: [],
	},
	alternatives: [
		{ label: "direct", text: "Direct.", why: "Why direct." },
		{ label: "warm", text: "Warm.", why: "Why warm." },
		{ label: "boundaried", text: "Boundaried.", why: "Why boundaried." },
	],
});

function stubApi(response: string): ModelAPI {
	return { generate: async () => response };
}

test("OllamaAnalyzer: valid JSON response returns parsed AnalyzerOutput", async () => {
	const analyzer = new OllamaAnalyzer(stubApi(validSuccessJson));
	const result = await analyzer.analyze("Hello", unspecified);
	assert.equal(result.ok, true);
	assert.equal(result.schema_version, "message-mirror.v1");
});

test("OllamaAnalyzer: invalid JSON throws InvalidAnalyzerOutputError", async () => {
	const analyzer = new OllamaAnalyzer(stubApi("not json at all"));
	await assert.rejects(() => analyzer.analyze("Hello", unspecified), InvalidAnalyzerOutputError);
});

test("OllamaAnalyzer: schema-invalid JSON throws InvalidAnalyzerOutputError", async () => {
	const analyzer = new OllamaAnalyzer(stubApi('{"broken": true}'));
	await assert.rejects(() => analyzer.analyze("Hello", unspecified), InvalidAnalyzerOutputError);
});

test("OllamaAnalyzer: network error propagates as plain Error, not InvalidAnalyzerOutputError", async () => {
	const failingApi: ModelAPI = {
		generate: async () => {
			throw new Error("connection refused");
		},
	};
	const analyzer = new OllamaAnalyzer(failingApi);
	await assert.rejects(
		() => analyzer.analyze("Hello", unspecified),
		(err: unknown) => err instanceof Error && !(err instanceof InvalidAnalyzerOutputError),
	);
});

test("OllamaRepairAPI: returns the model API response string", async () => {
	const repairApi = new OllamaRepairAPI(stubApi("repaired output"));
	const result = await repairApi.repair("malformed input");
	assert.equal(result, "repaired output");
});

test("OllamaRepairAPI: repair prompt contains the malformed input", async () => {
	let capturedPrompt = "";
	const capturingApi: ModelAPI = {
		generate: async (prompt) => {
			capturedPrompt = prompt;
			return "{}";
		},
	};
	const repairApi = new OllamaRepairAPI(capturingApi);
	await repairApi.repair("sentinel-malformed-sentinel");
	assert.ok(
		capturedPrompt.includes("sentinel-malformed-sentinel"),
		"repair prompt must include the malformed output",
	);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
nix develop --command pnpm run test:unit
```

Expected: all 6 tests fail with `Cannot find module '../../src/analyzer/ollama.js'`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/analyzer/ollama.test.ts
git commit -m "Add failing unit tests for OllamaAnalyzer and OllamaRepairAPI"
```

---

### Task 3: Implement `src/analyzer/ollama.ts`

**Files:**
- Create: `src/analyzer/ollama.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/analyzer/ollama.ts
import { toJSONSchema } from "zod";
import { InvalidAnalyzerOutputError } from "./errors.js";
import type { ModelRepairAPI } from "./repairing.js";
import type { Analyzer } from "./types.js";
import { AnalyzerOutputSchema, type AnalyzerOutput } from "../output/schema.js";
import type { Calibration } from "../cli/calibration.js";

export interface ModelAPI {
	generate(prompt: string, format?: unknown): Promise<string>;
}

export class OllamaModelAPI implements ModelAPI {
	constructor(
		private readonly url: string,
		private readonly model: string,
	) {}

	async generate(prompt: string, format?: unknown): Promise<string> {
		const body: Record<string, unknown> = { model: this.model, prompt, stream: false };
		if (format !== undefined) body["format"] = format;
		const response = await fetch(`${this.url}/api/generate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			throw new Error(`ollama request failed with status ${response.status}`);
		}
		const data = (await response.json()) as { response: string };
		return data.response;
	}
}

const analyzerOutputJsonSchema = toJSONSchema(AnalyzerOutputSchema);

export class OllamaAnalyzer implements Analyzer {
	constructor(private readonly api: ModelAPI) {}

	async analyze(draft: string, calibration: Calibration): Promise<AnalyzerOutput> {
		const prompt = buildAnalyzePrompt(draft, calibration);
		const raw = await this.api.generate(prompt, analyzerOutputJsonSchema);
		return parseAndValidate(raw);
	}
}

export class OllamaRepairAPI implements ModelRepairAPI {
	constructor(private readonly api: ModelAPI) {}

	async repair(malformed: string): Promise<string> {
		const prompt = buildRepairPrompt(malformed);
		return this.api.generate(prompt, analyzerOutputJsonSchema);
	}
}

function parseAndValidate(raw: string): AnalyzerOutput {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new InvalidAnalyzerOutputError(raw);
	}
	const result = AnalyzerOutputSchema.safeParse(parsed);
	if (!result.success) throw new InvalidAnalyzerOutputError(raw);
	return result.data;
}

function buildAnalyzePrompt(draft: string, calibration: Calibration): string {
	const rel = calibration.relationship === "unspecified" ? "not specified" : calibration.relationship;
	const goal = calibration.goal === "unspecified" ? "not specified" : calibration.goal;
	const tone = calibration.desired_tone === "unspecified" ? "not specified" : calibration.desired_tone;
	return [
		"Draft message:",
		draft,
		"",
		"Calibration:",
		`- Relationship context: ${rel}`,
		`- Communication goal: ${goal}`,
		`- Desired tone: ${tone}`,
		"",
		"Return valid JSON only, with no additional text.",
	].join("\n");
}

function buildRepairPrompt(malformed: string): string {
	const schema = JSON.stringify(analyzerOutputJsonSchema, null, 2);
	return [
		"The following JSON output does not conform to the required schema.",
		"Correct it and return only valid JSON, with no additional text.",
		"",
		"Required schema:",
		schema,
		"",
		"Invalid output to correct:",
		malformed,
	].join("\n");
}
```

- [ ] **Step 2: Run the unit tests and confirm they all pass**

```bash
nix develop --command pnpm run test:unit
```

Expected: 6 tests pass, 0 fail.

- [ ] **Step 3: Run typecheck**

```bash
nix develop --command pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/analyzer/ollama.ts
git commit -m "Implement OllamaAnalyzer, OllamaRepairAPI, and OllamaModelAPI"
```

---

### Task 4: Wire `buildAnalyzer()` in `run.ts`

**Files:**
- Modify: `src/cli/run.ts`

- [ ] **Step 1: Update `run.ts`**

Replace the entire file with:

```typescript
import type { Readable } from "node:stream";
import { RepairExhaustedError } from "../analyzer/errors.js";
import { createFakeAnalyzer, createFakeRepairApi } from "../analyzer/fake.js";
import { OllamaAnalyzer, OllamaModelAPI, OllamaRepairAPI } from "../analyzer/ollama.js";
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
const ollamaUrlEnvName = "MESSAGE_MIRROR_OLLAMA_URL";
const modelEnvName = "MESSAGE_MIRROR_MODEL";
const defaultOllamaUrl = "http://127.0.0.1:11434";
const defaultModel = "message-mirror";

export async function runCli(args: string[], io: IO, injectAnalyzer?: Analyzer): Promise<void> {
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

	const analyzer = injectAnalyzer ?? buildAnalyzer();

	try {
		const output = await analyzer.analyze(draft, calibrationResult.calibration);
		// Runtime schema validation and repair happen inside RepairingAnalyzer.
		// runCli trusts the Analyzer interface contract: returns AnalyzerOutput or throws.
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

function buildAnalyzer(): Analyzer {
	if (process.env[analyzerEnvName] === "fake") {
		const scenario = process.env[fakeScenarioEnvName];
		return new RepairingAnalyzer(createFakeAnalyzer(scenario), createFakeRepairApi(scenario));
	}
	const url = process.env[ollamaUrlEnvName] ?? defaultOllamaUrl;
	const model = process.env[modelEnvName] ?? defaultModel;
	const api = new OllamaModelAPI(url, model);
	return new RepairingAnalyzer(new OllamaAnalyzer(api), new OllamaRepairAPI(api));
}

function writeError(io: IO, message: string): void {
	io.stderr.write(`${message}\n`);
	io.setExitCode(1);
}
```

- [ ] **Step 2: Run the golden test suite to confirm fake path still works**

```bash
nix develop --command pnpm run test
```

Expected: 13 tests pass, 0 fail.

- [ ] **Step 3: Run typecheck and lint**

```bash
nix develop --command pnpm run typecheck && nix develop --command pnpm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/cli/run.ts
git commit -m "Wire Ollama backend as production default in buildAnalyzer"
```

---

### Task 5: Final validation

**Files:** none — verification only

- [ ] **Step 1: Run all test suites**

```bash
nix develop --command pnpm run test && nix develop --command pnpm run test:unit && nix develop --command pnpm run test:property
```

Expected: all suites pass (13 golden + 6 unit + 4 property = 23 tests total), 0 failures.

- [ ] **Step 2: Run typecheck for both src and tests**

```bash
nix develop --command pnpm run typecheck && nix develop --command pnpm run typecheck:test
```

Expected: no errors.

- [ ] **Step 3: Run lint and format check**

```bash
nix develop --command pnpm run lint && nix develop --command pnpm run format:check
```

Expected: no errors.

- [ ] **Step 4: Inspect the diff**

```bash
git diff main
```

Confirm:
- `src/analyzer/ollama.ts` is new — `ModelAPI`, `OllamaModelAPI`, `OllamaAnalyzer`, `OllamaRepairAPI`
- `src/cli/run.ts` — `buildAnalyzer` no longer returns `null`, Ollama is the default path
- `tests/analyzer/ollama.test.ts` is new — 6 unit tests
- `package.json` — `test:unit` script added
- `.github/workflows/ci.yml` — unit test step added
- No draft text, raw prompts, or model output appears in any error path
