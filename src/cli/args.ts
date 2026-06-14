import { Command, CommanderError } from "commander";

import {
  type Calibration,
  desiredToneValues,
  goalValues,
  relationshipValues,
} from "./calibration.js";

interface ParsedOptions {
  relationship?: string;
  goal?: string;
  desiredTone?: string;
}

export type ParseCliArgsResult =
  | { ok: true; calibration: Calibration }
  | { ok: false; kind: "usage"; message: string }
  | { ok: false; kind: "stdout"; message: string };

export function parseCliArgs(args: string[]): ParseCliArgsResult {
  let stdout = "";
  let stderr = "";
  const command = createCommand({
    writeOut: (chunk) => {
      stdout += chunk;
    },
    writeErr: (chunk) => {
      stderr += chunk;
    },
  });

  try {
    command.parse(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return { ok: false, kind: "stdout", message: stdout };
      }

      return { ok: false, kind: "usage", message: stderr.trimEnd() || error.message };
    }
    throw error;
  }

  return normalizeCalibration(command.opts<ParsedOptions>());
}

interface OutputWriters {
  writeOut: (chunk: string) => void;
  writeErr: (chunk: string) => void;
}

function createCommand(output: OutputWriters): Command {
  return new Command()
    .name("message-mirror")
    .description(
      "Analyze one draft message from stdin with a local-only analyzer. No draft messages, prompts, or model responses are retained by default.",
    )
    .exitOverride()
    .configureHelp({ helpWidth: 200 })
    .configureOutput(output)
    .allowExcessArguments(false)
    .option(
      "--relationship <relationship>",
      `relationship calibration: ${relationshipValues.join(", ")}`,
    )
    .option("--goal <goal>", `goal calibration: ${goalValues.join(", ")}`)
    .option(
      "--desired-tone <desiredTone>",
      `desired tone calibration: ${desiredToneValues.join(", ")}`,
    )
    .version("message-mirror 0.0.0");
}

function normalizeCalibration(options: ParsedOptions): ParseCliArgsResult {
  const relationship = normalizeOptionalEnum(
    "--relationship",
    options.relationship,
    relationshipValues,
  );
  if (!relationship.ok) {
    return relationship;
  }

  const goal = normalizeOptionalEnum("--goal", options.goal, goalValues);
  if (!goal.ok) {
    return goal;
  }

  const desiredTone = normalizeOptionalEnum(
    "--desired-tone",
    options.desiredTone,
    desiredToneValues,
  );
  if (!desiredTone.ok) {
    return desiredTone;
  }

  return {
    ok: true,
    calibration: {
      relationship: relationship.value,
      goal: goal.value,
      desired_tone: desiredTone.value,
    },
  };
}

function normalizeOptionalEnum<const Values extends readonly string[]>(
  flag: string,
  value: string | undefined,
  allowedValues: Values,
):
  | { ok: true; value: Values[number] | "unspecified" }
  | { ok: false; kind: "usage"; message: string } {
  if (value === undefined) {
    return { ok: true, value: "unspecified" };
  }

  if (isAllowed(value, allowedValues)) {
    return { ok: true, value };
  }

  return {
    ok: false,
    kind: "usage",
    message: `error: invalid value '${value}' for ${flag}\nallowed values: ${allowedValues.join(", ")}`,
  };
}

function isAllowed<const Values extends readonly string[]>(
  value: string,
  allowedValues: Values,
): value is Values[number] {
  return allowedValues.includes(value);
}
