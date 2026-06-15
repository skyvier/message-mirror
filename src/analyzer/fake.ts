import type { Calibration } from "../cli/calibration.js";
import type { SuccessOutput } from "../output/schema.js";

type FakeScenario = (calibration: Calibration) => SuccessOutput;

const fakeScenarios: Record<string, FakeScenario> = {
  "success-calibrated": analyzeSuccessfulApology,
  "success-unspecified": analyzeSuccessfulApology,
};

export function analyzeWithFakeScenario(
  calibration: Calibration,
  scenario: string | undefined,
): SuccessOutput {
  const fakeScenario = fakeScenarios[scenario ?? ""];
  if (fakeScenario === undefined) {
    throw new Error("unsupported fake analyzer scenario");
  }

  return fakeScenario(calibration);
}

function analyzeSuccessfulApology(calibration: Calibration): SuccessOutput {
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
