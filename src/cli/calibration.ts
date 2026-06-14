export const relationshipValues = [
  "friend",
  "family",
  "new_acquaintance",
  "partner",
  "coworker",
  "manager",
  "direct_report",
  "client",
  "ex",
] as const;

export const goalValues = [
  "apology",
  "boundary",
  "clarification",
  "invitation",
  "decline",
  "feedback",
  "repair",
  "check_in",
  "logistics",
  "hard_conversation",
] as const;

export const desiredToneValues = ["warm", "direct", "gentle", "firm", "neutral", "brief"] as const;

export type Relationship = (typeof relationshipValues)[number];
export type Goal = (typeof goalValues)[number];
export type DesiredTone = (typeof desiredToneValues)[number];

export interface Calibration {
  relationship: Relationship | "unspecified";
  goal: Goal | "unspecified";
  desired_tone: DesiredTone | "unspecified";
}
