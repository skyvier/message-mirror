# Ollama Backend Design

**Date:** 2026-06-17
**Scope:** `src/analyzer/ollama.ts` + wiring in `src/cli/run.ts`

## Goal

Implement the real local analyzer backend so the CLI works without `MESSAGE_MIRROR_ANALYZER=fake`. The backend talks to a local Ollama-compatible server using the `/api/generate` endpoint, validates and repairs model output, and satisfies the privacy contract from the spec.

## Components

Four exports from `src/analyzer/ollama.ts`:

```
ModelAPI          — interface: generate(prompt, format?): Promise<string>
OllamaModelAPI    — real HTTP implementation, constructor takes (url, model)
OllamaAnalyzer    — implements Analyzer, constructor takes ModelAPI
OllamaRepairAPI   — implements ModelRepairAPI, constructor takes ModelAPI
```

`ModelAPI` is the injectable abstraction over the Ollama HTTP transport. Tests inject stubs; production wires in `OllamaModelAPI`.

## Prompt Format

### Analyze prompt (structured prose, Option A)

```
Draft message:
<draft text>

Calibration:
- Relationship context: <value or "not specified">
- Communication goal: <value or "not specified">
- Desired tone: <value or "not specified">

Return valid JSON only, with no additional text.
```

"Unspecified" calibration values render as "not specified" to avoid leaking internal enum vocabulary into the prompt.

### Repair prompt

```
The following JSON output does not conform to the required schema.
Correct it and return only valid JSON, with no additional text.

Required schema:
<toJSONSchema(AnalyzerOutputSchema) as JSON>

Invalid output to correct:
<malformed string>
```

The repair prompt never contains the original draft. This is enforced by the `ModelRepairAPI` interface contract: `repair(malformed)` receives only the malformed output.

## Structured Output (`format` field)

Both `OllamaAnalyzer` and `OllamaRepairAPI` pass the JSON Schema (derived via `toJSONSchema(AnalyzerOutputSchema)`) as the `format` field in the `/api/generate` request body. Ollama uses grammar-constrained generation to guarantee the output is valid JSON matching the schema shape.

The repair loop (`RepairingAnalyzer`) is still active as a safety net — structured output constrains JSON shape but not semantic correctness.

## `OllamaModelAPI` HTTP Contract

```
POST <url>/api/generate
Content-Type: application/json

{ "model": "<model>", "prompt": "<prompt>", "stream": false, "format": <schema> }
```

Response: `{ "response": "<model output>", ... }` — only `response` is used.

Non-2xx status → throws plain `Error` (not `InvalidAnalyzerOutputError`), which propagates through `RepairingAnalyzer` to `runCli`, which writes `error: local analyzer backend unavailable`.

## Error Handling

| Condition | Thrown by | Caught by |
|---|---|---|
| Non-2xx HTTP | `OllamaModelAPI` | `runCli` → "backend unavailable" |
| Network failure | `OllamaModelAPI` | `runCli` → "backend unavailable" |
| Invalid JSON / schema failure | `OllamaAnalyzer` | `RepairingAnalyzer` → repair loop |
| Repair exhausted | `RepairingAnalyzer` | `runCli` → "invalid schema after N attempts" |

## Wiring in `run.ts`

`buildAnalyzer()` updated:

```
MESSAGE_MIRROR_ANALYZER=fake  → existing fake path (unchanged)
otherwise                     → read MESSAGE_MIRROR_OLLAMA_URL (default: http://127.0.0.1:11434)
                                read MESSAGE_MIRROR_MODEL (default: message-mirror)
                                new OllamaModelAPI(url, model)
                                new RepairingAnalyzer(
                                  new OllamaAnalyzer(api),
                                  new OllamaRepairAPI(api)
                                )
```

## Schema Source

JSON Schema for both `format` field and repair prompt is derived at call time via `toJSONSchema(AnalyzerOutputSchema)` from `zod`. No file I/O. Always in sync with the Zod definitions.

## Testing

- `tests/analyzer/ollama.test.ts` — unit tests with stub `ModelAPI`
- New `test:unit` script: `tsx --test 'tests/**/*.test.ts'`
- CI: new `Unit tests` step running `pnpm run test:unit`
- Smoke test against real Ollama: out of scope (optional per spec)

### Unit test cases

- Valid JSON response → returns `AnalyzerOutput`
- Invalid JSON → throws `InvalidAnalyzerOutputError`
- Schema-invalid JSON → throws `InvalidAnalyzerOutputError`
- Network error → propagates as plain `Error` (not `InvalidAnalyzerOutputError`)
- `OllamaRepairAPI` → returns model response string
- `OllamaRepairAPI` → repair prompt contains the malformed input
