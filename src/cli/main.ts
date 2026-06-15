#!/usr/bin/env node

import { RepairExhaustedError } from "../analyzer/errors.js";
import { createFakeAnalyzer, createFakeRepairApi } from "../analyzer/fake.js";
import { RepairingAnalyzer } from "../analyzer/repairing.js";
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
    const scenario = process.env[fakeScenarioEnvName];
    const analyzer = new RepairingAnalyzer(
      createFakeAnalyzer(scenario),
      createFakeRepairApi(scenario),
    );
    const output = await analyzer.analyze(draft, calibrationResult.calibration);
    // Runtime schema validation and repair happen inside RepairingAnalyzer.
    // main.ts trusts the Analyzer interface contract: returns AnalyzerOutput or throws.
    process.stdout.write(formatJson(output));
  } catch (error) {
    if (error instanceof RepairExhaustedError) {
      failWithInternalError("error: analyzer returned invalid schema after 3 repair attempts");
    } else {
      failWithInternalError("error: local analyzer backend unavailable");
    }
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
