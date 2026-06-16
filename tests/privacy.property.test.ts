import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import fc from "fast-check";
import { InvalidAnalyzerOutputError } from "../src/analyzer/errors.js";
import { RepairingAnalyzer, type ModelRepairAPI } from "../src/analyzer/repairing.js";
import type { Analyzer } from "../src/analyzer/types.js";
import { goalValues, type Calibration } from "../src/cli/calibration.js";
import type { AnalyzerOutput } from "../src/output/schema.js";
import { type IO, runCli } from "../src/cli/run.js";

function makeIO(draft: string): { io: IO; stdout(): string; stderr(): string } {
  let out = "";
  let err = "";
  const io: IO = {
    stdin: Readable.from([draft]),
    stdout: {
      write: (s: string) => {
        out += s;
      },
    },
    stderr: {
      write: (s: string) => {
        err += s;
      },
    },
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
    if (parsed !== null && typeof parsed === "object" && "metadata" in parsed) {
      assert.equal(
        JSON.stringify((parsed as { metadata: unknown }).metadata).includes(trimmed),
        false,
        "draft must not appear in metadata",
      );
    }
  }
}

// Wrap arbitrary text in a needle that cannot appear in any fixed error string,
// guaranteeing no accidental overlap with stderr output.
const draftArb = fc.string({ maxLength: 200 }).map((s) => `needle-${s}-needle`);

// Goal values that are definitely not in the allowed enum.
const invalidGoalArb = fc
  .string({ minLength: 1 })
  .filter((s) => !(goalValues as readonly string[]).includes(s));

test("adversarial analyzer: plain Error thrown by analyzer does not leak draft to stderr", async () => {
  await fc.assert(
    fc.asyncProperty(draftArb, async (draft) => {
      const adversarial: Analyzer = {
        analyze: async (d: string, _calibration: Calibration): Promise<AnalyzerOutput> => {
          throw new Error(d);
        },
      };
      // Plain Error is re-thrown by RepairingAnalyzer before repair is attempted.
      // This repair API should never be called — it throws to surface any regression.
      const repairApi: ModelRepairAPI = {
        repair: async () => {
          throw new Error("repair must not be called for plain Error");
        },
      };
      const { io, stdout, stderr } = makeIO(draft);
      await runCli([], io, new RepairingAnalyzer(adversarial, repairApi));
      assertNoDraftLeak(draft, stdout(), stderr());
    }),
    { numRuns: 100 },
  );
});

test("adversarial analyzer: InvalidAnalyzerOutputError(draft) + schema-invalid repair does not leak draft", async () => {
  await fc.assert(
    fc.asyncProperty(draftArb, async (draft) => {
      const adversarial: Analyzer = {
        analyze: async (d: string, _calibration: Calibration): Promise<AnalyzerOutput> => {
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
        analyze: async (d: string, _calibration: Calibration): Promise<AnalyzerOutput> => {
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
