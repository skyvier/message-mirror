# Message Mirror v1 Spec

## Product Boundary

`message-mirror` is a local-first CLI that accepts one draft message on stdin and returns a structured JSON analysis of how the message may land emotionally and socially.

The tool optimizes for honesty, clarity, kindness, boundaries, dignity, and respect for the recipient's autonomy. It does not optimize for getting a desired reaction from the recipient.

## In Scope

- Analyze a single plain-text draft message from stdin.
- Accept optional predetermined calibration flags:
  - `--relationship`
  - `--goal`
  - `--desired-tone`
- Return valid, pretty-printed JSON for successful analysis and domain refusals.
- Use a local Ollama-compatible analyzer backend by default.
- Validate output against a versioned JSON Schema.
- Retry malformed analyzer output with format-only repair attempts.
- Provide deterministic golden-testable CLI behavior.

## Out of Scope

- Sending messages or integrating with messaging platforms.
- Reading chat history, contacts, screenshots, attachments, or files besides stdin redirection.
- Hosted model or hosted API fallback.
- Persistent storage, telemetry, analytics, default logs, or crash dumps containing user input.
- Recipient profiling, diagnosis, attachment-style inference, or claims about what the recipient definitely thinks or feels.
- Strategy to elicit a desired response.
- Manipulative rewrites, guilt scripts, jealousy tactics, deception, threats, harassment, consent evasion, or exploitation.
- Interactive chat mode.
- Config files.
- Multiple output formats.
- Free-form calibration values.
- Confidence scores, severity scores, timestamps, request IDs, or durations in the output JSON.

## CLI Contract

The command name is:

```bash
message-mirror
```

Example:

```bash
message-mirror \
  --relationship friend \
  --goal apology \
  --desired-tone warm < draft.txt
```

Rules:

- Draft message input is stdin only.
- The CLI does not accept the draft as a positional argument or flag.
- Calibration options are optional.
- Missing calibration options normalize to `"unspecified"` in output metadata.
- Invalid enum values are usage errors and are reported on stderr.
- Successful analysis and domain refusals write JSON to stdout.
- Usage errors and internal errors write deterministic, non-sensitive text to stderr.
- No default logging.
- JSON output is pretty-printed with two-space indentation and a trailing newline.
- CLI output uses deterministic object key order matching this spec.

### Calibration Flags

Allowed `--relationship` values:

- `friend`
- `family`
- `new_acquaintance`
- `partner`
- `coworker`
- `manager`
- `direct_report`
- `client`
- `ex`

Allowed `--goal` values:

- `apology`
- `boundary`
- `clarification`
- `invitation`
- `decline`
- `feedback`
- `repair`
- `check_in`
- `logistics`
- `hard_conversation`

Allowed `--desired-tone` values:

- `warm`
- `direct`
- `gentle`
- `firm`
- `neutral`
- `brief`

`"unspecified"` is an output normalization value only. It is not accepted as a user-provided enum value.

`--goal` is descriptive calibration, not an instruction to maximize the chance of achieving that outcome. For example, `--goal repair` means "analyze this as a repair attempt," not "make them forgive me."

`--desired-tone` affects both analysis and alternatives. The analysis should evaluate whether the draft already matches the requested tone and identify risks caused by mismatch. Alternatives should adapt toward the requested tone without violating ethical constraints or the fixed alternative labels.

Semantic mismatch between the selected goal and the draft is analyzable content, not a CLI validation failure. For example, `--goal apology` with a non-apologetic draft should usually return `ok: true` and note the mismatch under risks or hidden assumptions, unless the draft crosses into refusal territory.

### Input Validation

- Leading and trailing whitespace are trimmed before validation and analysis.
- Internal whitespace and line breaks are preserved.
- Empty or whitespace-only stdin is a usage error.
- Maximum draft length is 10,000 Unicode characters after trimming.
- Draft content must not be echoed in validation errors.

Example errors:

```text
error: draft message is empty
error: draft message exceeds 10000 characters
```

Invalid enum values are CLI usage errors, not analyzer refusals.

Example:

```text
error: invalid value 'make_them_reply' for --goal
allowed values: apology, boundary, clarification, invitation, decline, feedback, repair, check_in, logistics, hard_conversation
```

### Utility Commands

`--help`:

- Exits `0`.
- Writes usage text to stdout.
- Does not require stdin.
- Lists allowed enum values.
- Mentions stdin-only input.
- Mentions the local-only and no-retention privacy baseline.
- Does not produce JSON.

`--version`:

- Exits `0`.
- Writes a deterministic version string to stdout.
- Does not require stdin.
- Does not produce JSON.

## Privacy Contract

v1 is local-first.

The tool must not persist draft messages, CLI inputs, model prompts, model responses, logs, telemetry, analytics, or crash reports by default.

The tool may write only:

- Final JSON responses to stdout.
- Deterministic validation or internal errors to stderr.
- `--help` and `--version` output for utility commands.

If future debug logging exists, it must be opt-in and redact the draft message by default.

Privacy metadata is included in analyzer outputs:

```json
{
  "local_only": true,
  "retained": false
}
```

This metadata is part of the contract and must be golden-tested, but it does not replace implementation-level privacy tests.

Alternatives may reuse harmless wording from the draft when necessary. The full original draft must not appear in metadata, errors, or refusal text. On success, privacy tests should assert that the full draft does not appear outside `alternatives[].text`. On refusal, the full draft must not appear anywhere in stdout or stderr.

## Backend Contract

v1 targets a local Ollama-compatible analyzer backend.

Defaults:

- `MESSAGE_MIRROR_OLLAMA_URL=http://127.0.0.1:11434`
- `MESSAGE_MIRROR_MODEL=message-mirror`

Backend configuration is environment-variable only in v1. There are no backend CLI flags.

There is no remote fallback. If the local analyzer backend is unavailable, the CLI exits non-zero with a non-sensitive stderr error:

```text
error: local analyzer backend unavailable
```

The documented local model setup is:

```bash
ollama create message-mirror -f Modelfile
```

## Output Schema

Every analyzer JSON output has:

- Top-level `schema_version`.
- Top-level `ok`.
- Top-level `metadata`.
- Either success fields or refusal fields.
- No additional top-level fields.

`schema_version` is always:

```json
"message-mirror.v1"
```

Object key order is deterministic in CLI output for golden tests. JSON Schema validation does not depend on key order.

### Metadata

All analyzer outputs include:

```json
{
  "input_source": "stdin",
  "privacy": {
    "local_only": true,
    "retained": false
  },
  "calibration": {
    "relationship": "friend",
    "goal": "apology",
    "desired_tone": "warm"
  }
}
```

When calibration flags are omitted, their values are explicit:

```json
{
  "relationship": "unspecified",
  "goal": "unspecified",
  "desired_tone": "unspecified"
}
```

### Success Output

Top-level field order:

1. `schema_version`
2. `ok`
3. `metadata`
4. `analysis`
5. `alternatives`

Shape:

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
      "relationship": "friend",
      "goal": "apology",
      "desired_tone": "warm"
    }
  },
  "analysis": {
    "apparent_intent": "string",
    "emotional_tone": [
      "string"
    ],
    "possible_interpretations": [
      "string"
    ],
    "risks_or_ambiguities": [
      "string"
    ],
    "hidden_needs_or_assumptions": [
      "string"
    ]
  },
  "alternatives": [
    {
      "label": "direct",
      "text": "string",
      "why": "string"
    },
    {
      "label": "warm",
      "text": "string",
      "why": "string"
    },
    {
      "label": "boundaried",
      "text": "string",
      "why": "string"
    }
  ]
}
```

Rules:

- `ok` is literal `true`.
- All fields shown are required.
- No additional top-level fields are allowed.
- `analysis.emotional_tone` has at least 1 item.
- `analysis.possible_interpretations` has at least 1 item.
- `analysis.risks_or_ambiguities` may be empty.
- `analysis.hidden_needs_or_assumptions` may be empty.
- All semantic string fields are non-empty after trimming.
- `alternatives` has exactly 3 items.
- Alternative labels are exactly `direct`, `warm`, `boundaried`, in that order.
- If the original message is already good, the analysis should say so and alternatives may be minor variants.

### Refusal Output

Domain refusals apply when either the selected calibration or the draft asks for manipulation, coercion, deception, punishment, guilt-tripping, jealousy induction, threats, harassment, evading consent, or exploiting vulnerability.

Since v1 calibration flags are fixed safe enums, content-level safety decisions are made by the analyzer, not CLI pre-screening.

Refusals are valid analyzer outcomes:

- Exit code `0`.
- JSON written to stdout.
- No stderr output unless another non-domain error occurs.

Top-level field order:

1. `schema_version`
2. `ok`
3. `metadata`
4. `refusal`

Shape:

```json
{
  "schema_version": "message-mirror.v1",
  "ok": false,
  "metadata": {
    "input_source": "stdin",
    "privacy": {
      "local_only": true,
      "retained": false
    },
    "calibration": {
      "relationship": "partner",
      "goal": "repair",
      "desired_tone": "firm"
    }
  },
  "refusal": {
    "category": "guilt_pressure",
    "reason": "The draft pressures the recipient to respond through guilt rather than direct communication.",
    "safer_frame": "State your feelings and request clearly while leaving the recipient free to choose whether to respond."
  }
}
```

Rules:

- `ok` is literal `false`.
- All fields shown are required.
- No `analysis` field is allowed.
- No `alternatives` field is allowed.
- No additional top-level fields are allowed.
- `refusal.reason` is non-empty after trimming.
- `refusal.safer_frame` is non-empty after trimming.
- The refusal may offer a safer communication frame.
- The refusal must not rewrite the message to accomplish the harmful aim.

Allowed `refusal.category` values:

- `manipulation`
- `coercion`
- `deception`
- `guilt_pressure`
- `jealousy_induction`
- `threat`
- `harassment`
- `consent_evasion`
- `exploitation`
- `unsafe_other`

## Schema File

v1 requires a machine-readable JSON Schema file:

```text
schema/message-mirror.v1.schema.json
```

Rules:

- The schema covers both success and refusal outputs with `oneOf`.
- `additionalProperties: false` is used wherever possible.
- Calibration values and refusal categories are enums.
- The success alternative labels and order are validated.
- Golden stdout fixtures are validated against this schema.
- Repair prompts use this same schema as the formatting contract.

## Analyzer Output Repair

The CLI must not pass malformed analyzer output through to the user.

If the analyzer response is invalid JSON or fails the expected schema:

- The tool makes up to 3 repair attempts.
- This means 1 initial analyzer attempt plus 3 repair attempts, for 4 total model calls maximum.
- Repair attempts are format-only.
- Repair attempts receive only the malformed output and schema instructions.
- Repair attempts do not receive the original draft.
- If repair succeeds, the repaired valid JSON is emitted.
- If repair is exhausted, the CLI exits non-zero and writes a deterministic stderr error.

Example exhausted-repair error:

```text
error: analyzer returned invalid schema after 3 repair attempts
```

The exhausted-repair error must not expose:

- The draft message.
- Calibration inputs.
- Raw model output.
- Prompt content.

## Golden Tests

Tests use a deterministic fake analyzer rather than snapshotting live model prose.

Fake analyzer selection is test-only and controlled by environment variables, not public CLI flags:

```bash
MESSAGE_MIRROR_ANALYZER=fake MESSAGE_MIRROR_FAKE_SCENARIO=success-calibrated \
  message-mirror --relationship friend --goal apology --desired-tone warm < tests/golden/success-calibrated.stdin
```

The production default is the real local analyzer backend.

### Fixture Layout

Success and refusal cases use:

```text
tests/golden/<case>.stdin
tests/golden/<case>.args
tests/golden/<case>.stdout.json
```

Error cases use:

```text
tests/golden/<case>.stdin
tests/golden/<case>.args
tests/golden/<case>.stderr
tests/golden/<case>.exit
```

### Minimum Golden Suite

- `success-unspecified`: stdin only, all calibration values normalize to `"unspecified"`.
- `success-calibrated`: all three calibration flags set.
- `success-multiline`: preserves internal line breaks during the analysis path.
- `refusal-guilt-pressure`: valid CLI args, harmful draft, `ok: false`, exit `0`.
- `invalid-goal`: invalid enum, non-zero, stderr only.
- `empty-stdin`: whitespace-only stdin, non-zero, stderr only.
- `too-long`: over 10,000 characters, non-zero, stderr only.
- `malformed-model-repaired`: fake analyzer first returns invalid schema, repair succeeds.
- `malformed-model-exhausted`: fake analyzer and repair stay invalid, non-zero, stderr only.
- `privacy-no-input-leak`: verifies stderr and metadata do not contain draft text.

### Success Assertions

Golden tests for success assert:

- stdout is valid JSON.
- stdout validates against `schema/message-mirror.v1.schema.json`.
- `schema_version` is `"message-mirror.v1"`.
- `metadata.input_source` is `"stdin"`.
- `metadata.privacy.local_only` is `true`.
- `metadata.privacy.retained` is `false`.
- `metadata.calibration.relationship`, `metadata.calibration.goal`, and `metadata.calibration.desired_tone` exist.
- Omitted calibration options become `"unspecified"`.
- `ok` is `true`.
- Required `analysis` keys exist with correct types.
- `analysis.emotional_tone` and `analysis.possible_interpretations` are non-empty.
- `alternatives` has exactly 3 items.
- Alternative labels are exactly `direct`, `warm`, `boundaried`, in that order.
- The full original draft does not appear in metadata or errors.

### Refusal Assertions

Golden tests for refusals assert:

- Valid CLI args with harmful content return `ok: false`.
- Exit code is `0`.
- stdout is valid JSON.
- stdout validates against `schema/message-mirror.v1.schema.json`.
- stderr is empty.
- `metadata` includes `input_source`, `privacy`, and `calibration`.
- `refusal.category` is one of the allowed categories.
- `refusal.reason` and `refusal.safer_frame` are present and non-empty.
- `analysis` is absent.
- `alternatives` is absent.
- Refusal text does not provide a rewritten manipulative message.
- The full original draft does not appear anywhere in stdout or stderr.

### Error Assertions

Golden tests for usage and internal errors assert:

- Exit code is non-zero.
- stdout is empty.
- stderr contains deterministic non-sensitive text.
- stderr does not contain the draft.
- stderr does not contain raw prompts.
- stderr does not contain raw model output.

## Acceptance Criteria

- CLI validation tests pass for enum handling, stdin-only input, empty input, length limit, `--help`, and `--version`.
- JSON Schema validation passes for every successful and refusal golden stdout fixture.
- Privacy tests confirm no draft text appears in stderr for any error path.
- Fake analyzer tests prove repair succeeds when schema is fixed within 3 repair attempts.
- Fake analyzer tests prove repair exhaustion fails non-zero without leaking input.
- Real backend smoke test is optional and skipped unless Ollama and the configured model are available.
