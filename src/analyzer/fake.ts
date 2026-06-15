import type { Calibration } from "../cli/calibration.js";
import type { AnalyzerOutput, RefusalOutput, SuccessOutput } from "../output/schema.js";
import type { Analyzer } from "./types.js";

type ScenarioFn = (calibration: Calibration) => AnalyzerOutput;

const scenarios: Record<string, ScenarioFn> = {
  "success-calibrated": successfulApology,
  "success-unspecified": successfulApology,
  "success-multiline": successfulApology,
  "refusal-guilt-pressure": refusalGuiltPressure,
};

export function createFakeAnalyzer(scenario: string | undefined): Analyzer {
  const fn = scenarios[scenario ?? ""];
  if (fn === undefined) {
    throw new Error(`unsupported fake analyzer scenario: ${String(scenario)}`);
  }
  return new FakeAnalyzer(fn);
}

class FakeAnalyzer implements Analyzer {
  constructor(private readonly scenarioFn: ScenarioFn) {}

  async analyze(_draft: string, calibration: Calibration): Promise<AnalyzerOutput> {
    return this.scenarioFn(calibration);
  }
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
