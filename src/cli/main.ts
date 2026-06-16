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
