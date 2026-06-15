import type { Calibration } from "../cli/calibration.js";
import type { AnalyzerOutput, RefusalOutput, SuccessOutput } from "../output/schema.js";
import { InvalidAnalyzerOutputError } from "./errors.js";
import type { ModelRepairAPI } from "./repairing.js";
import type { Analyzer } from "./types.js";

type ScenarioFn = (calibration: Calibration) => AnalyzerOutput;

// The two exhausted-repair scenarios test distinct failure modes named in the spec:
//   malformed-model-exhausted:           model returns valid JSON that fails the schema
//   malformed-model-plain-text-exhausted: model returns plain text (not JSON at all)
// Both should exhaust repair and exit non-zero with the same error message.
// They are separate fixtures to prove the repair loop handles each path,
// not just the schema-invalid case.
const scenarios: Record<string, ScenarioFn> = {
  "success-calibrated": successfulApology,
  "success-unspecified": successfulApology,
  "success-multiline": successfulApology,
  "refusal-guilt-pressure": refusalGuiltPressure,
  "malformed-model-repaired": malformedInitialResponse,
  "malformed-model-exhausted": malformedInitialResponse,
  "malformed-model-plain-text-exhausted": malformedPlainTextResponse,
};

export function createFakeAnalyzer(scenario: string | undefined): Analyzer {
  const fn = scenarios[scenario ?? ""];
  if (fn === undefined) {
    throw new Error(`unsupported fake analyzer scenario: ${String(scenario)}`);
  }
  return new FakeAnalyzer(fn);
}

export function createFakeRepairApi(scenario: string | undefined): ModelRepairAPI {
  if (scenarios[scenario ?? ""] === undefined) {
    throw new Error(`unsupported fake analyzer scenario: ${String(scenario)}`);
  }
  return new FakeRepairAPI(scenario);
}

class FakeAnalyzer implements Analyzer {
  constructor(private readonly scenarioFn: ScenarioFn) {}

  async analyze(_draft: string, calibration: Calibration): Promise<AnalyzerOutput> {
    return this.scenarioFn(calibration);
  }
}

// Hardcoded to all-unspecified because repair calls do not receive calibration —
// the repair API only sees the malformed payload, never the original request.
const allUnspecifiedCalibration: Calibration = {
  relationship: "unspecified",
  goal: "unspecified",
  desired_tone: "unspecified",
};

class FakeRepairAPI implements ModelRepairAPI {
  constructor(private readonly scenario: string | undefined) {}

  async repair(_malformed: string): Promise<string> {
    if (this.scenario === "malformed-model-repaired") {
      return JSON.stringify(successfulApology(allUnspecifiedCalibration));
    }
    if (this.scenario === "malformed-model-exhausted") {
      // Always returns schema-invalid JSON — RepairingAnalyzer will exhaust all attempts.
      return '{"broken":true}';
    }
    if (this.scenario === "malformed-model-plain-text-exhausted") {
      // Always returns plain text — RepairingAnalyzer will exhaust all attempts.
      return "Sure! Here is your analysis. The tone is warm and apologetic.";
    }
    throw new Error(
      `FakeRepairAPI: repair() called for non-malformed scenario: ${String(this.scenario)}`,
    );
  }
}

function malformedInitialResponse(_calibration: Calibration): AnalyzerOutput {
  throw new InvalidAnalyzerOutputError('{"broken":true}');
}

function malformedPlainTextResponse(_calibration: Calibration): AnalyzerOutput {
  throw new InvalidAnalyzerOutputError(
    "Sure! Here is your analysis. The tone is warm and apologetic.",
  );
}

function successfulApology(calibration: Calibration): SuccessOutput {
  return {
    schema_version: "message-mirror.v1",
    ok: true,
    metadata: {
      input_source: "stdin",
      privacy: {
        local_only: true,
        retained: false,
      },
      calibration,
    },
    analysis: {
      apparent_intent: "Apologize for a tense moment and reopen the conversation respectfully.",
      emotional_tone: ["accountable", "warm"],
      possible_interpretations: [
        "The recipient may hear a clear apology without pressure to respond immediately.",
      ],
      risks_or_ambiguities: [],
      hidden_needs_or_assumptions: [],
    },
    alternatives: [
      {
        label: "direct",
        text: "I am sorry I was short with you yesterday. That was unfair, and I will handle it differently next time.",
        why: "Names the apology plainly and keeps responsibility with the sender.",
      },
      {
        label: "warm",
        text: "I am sorry I was short with you yesterday. I care about our friendship and did not want to leave it there.",
        why: "Adds care while preserving the apology.",
      },
      {
        label: "boundaried",
        text: "I am sorry I was short with you yesterday. I wanted to acknowledge it, and there is no pressure to respond right away.",
        why: "Offers repair while respecting the recipient's autonomy.",
      },
    ],
  };
}

function refusalGuiltPressure(calibration: Calibration): RefusalOutput {
  return {
    schema_version: "message-mirror.v1",
    ok: false,
    metadata: {
      input_source: "stdin",
      privacy: {
        local_only: true,
        retained: false,
      },
      calibration,
    },
    refusal: {
      category: "guilt_pressure",
      reason:
        "The draft pressures the recipient to respond through guilt rather than direct communication.",
      safer_frame:
        "State your feelings and request clearly while leaving the recipient free to choose whether to respond.",
    },
  };
}
