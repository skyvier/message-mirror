#!/usr/bin/env node

import { analyzeWithFakeScenario } from "../analyzer/fake.js";
import { formatJson } from "../output/format.js";
import { parseCliArgs } from "./args.js";

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
    const output = analyzeWithFakeScenario(
      calibrationResult.calibration,
      process.env[fakeScenarioEnvName],
    );
    process.stdout.write(formatJson(output));
  } catch (_error) {
    failWithInternalError("error: local analyzer backend unavailable");
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      resolve(input);
    });
    process.stdin.on("error", reject);
  });
}

function failWithUsageError(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function failWithInternalError(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
