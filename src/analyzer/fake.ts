import type { Calibration } from "../cli/calibration.js";

export interface SuccessOutput {
  schema_version: "message-mirror.v1";
  ok: true;
  metadata: {
    input_source: "stdin";
    privacy: {
      local_only: true;
      retained: false;
    };
    calibration: Calibration;
  };
  analysis: {
    apparent_intent: string;
    emotional_tone: string[];
    possible_interpretations: string[];
    risks_or_ambiguities: string[];
    hidden_needs_or_assumptions: string[];
  };
  alternatives: [
    { label: "direct"; text: string; why: string },
    { label: "warm"; text: string; why: string },
    { label: "boundaried"; text: string; why: string },
  ];
}

export function analyzeWithFakeScenario(
  calibration: Calibration,
  scenario: string | undefined,
): SuccessOutput {
  if (scenario !== "success-calibrated") {
    throw new Error("unsupported fake analyzer scenario");
  }

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
