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

export type ParseCalibrationResult =
  | { ok: true; calibration: Calibration }
  | { ok: false; message: string };

export function parseCalibrationFlags(args: string[]): ParseCalibrationResult {
  const calibration: Calibration = {
    relationship: "unspecified",
    goal: "unspecified",
    desired_tone: "unspecified",
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];

    if (flag === "--relationship") {
      if (value === undefined || !isAllowed(value, relationshipValues)) {
        return invalidValue("--relationship", value, relationshipValues);
      }
      calibration.relationship = value;
      index += 1;
      continue;
    }

    if (flag === "--goal") {
      if (value === undefined || !isAllowed(value, goalValues)) {
        return invalidValue("--goal", value, goalValues);
      }
      calibration.goal = value;
      index += 1;
      continue;
    }

    if (flag === "--desired-tone") {
      if (value === undefined || !isAllowed(value, desiredToneValues)) {
        return invalidValue("--desired-tone", value, desiredToneValues);
      }
      calibration.desired_tone = value;
      index += 1;
      continue;
    }

    return { ok: false, message: `error: unknown option '${flag ?? ""}'` };
  }

  return { ok: true, calibration };
}

function invalidValue(
  flag: string,
  value: string | undefined,
  allowedValues: readonly string[],
): ParseCalibrationResult {
  return {
    ok: false,
    message: `error: invalid value '${value ?? ""}' for ${flag}\nallowed values: ${allowedValues.join(", ")}`,
  };
}

function isAllowed<const Values extends readonly string[]>(
  value: string,
  allowedValues: Values,
): value is Values[number] {
  return allowedValues.includes(value);
}
