#!/usr/bin/env node

import { createFakeAnalyzer } from "../analyzer/fake.js";
import { formatJson } from "../output/format.js";
import { parseCliArgs } from "./args.js";
import { readStdin } from "./input.js";

const maxDraftLength = 10_000;
const analyzerEnvName = "MESSAGE_MIRROR_ANALYZER";
const fakeScenarioEnvName = "MESSAGE_MIRROR_FAKE_SCENARIO";

void main();

async function main(): Promise<void> {
  const calibrationResult = parseCliArgs(process.argv.slice(2));
  if (!calibrationResult.ok) {
    if (calibrationResult.kind === "stdout") {
      process.stdout.write(calibrationResult.message);
      return;
    }

    failWithUsageError(calibrationResult.message);
    return;
  }

  const draft = (await readStdin()).trim();
  if (draft.length === 0) {
    failWithUsageError("error: draft message is empty");
    return;
  }

  if (draft.length > maxDraftLength) {
    failWithUsageError("error: draft message exceeds 10000 characters");
    return;
  }

  if (process.env[analyzerEnvName] !== "fake") {
    failWithInternalError("error: local analyzer backend unavailable");
    return;
  }

  try {
    const analyzer = createFakeAnalyzer(process.env[fakeScenarioEnvName]);
    const output = await analyzer.analyze(draft, calibrationResult.calibration);
    // Runtime schema validation happens inside the Analyzer chain. The repair loop
    // (next slice) intercepts validation failures before they reach this point.
    process.stdout.write(formatJson(output));
  } catch (_error) {
    failWithInternalError("error: local analyzer backend unavailable");
  }
}

function failWithUsageError(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

// Kept distinct from failWithUsageError — exit code and format may diverge in a future slice.
function failWithInternalError(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
