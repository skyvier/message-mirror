import { toJSONSchema } from "zod";
import type { Calibration } from "../cli/calibration.js";
import { InvalidAnalyzerOutputError } from "./errors.js";
import type { ModelRepairAPI } from "./repairing.js";
import type { Analyzer } from "./types.js";
import { AnalyzerOutputSchema, type AnalyzerOutput } from "../output/schema.js";

export interface ModelAPI {
  generate(prompt: string, format?: unknown): Promise<string>;
}

export class OllamaModelAPI implements ModelAPI {
  constructor(
    private readonly url: string,
    private readonly model: string,
  ) {}

  async generate(prompt: string, format?: unknown): Promise<string> {
    const body = {
      model: this.model,
      prompt,
      stream: false,
      ...(format !== undefined && { format }),
    };
    const response = await fetch(`${this.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`ollama request failed with status ${response.status}`);
    }
    const data = (await response.json()) as { response: string };
    return data.response;
  }
}

const analyzerOutputJsonSchema = toJSONSchema(AnalyzerOutputSchema);

export class OllamaAnalyzer implements Analyzer {
  constructor(private readonly api: ModelAPI) {}

  async analyze(draft: string, calibration: Calibration): Promise<AnalyzerOutput> {
    const prompt = buildAnalyzePrompt(draft, calibration);
    const raw = await this.api.generate(prompt, analyzerOutputJsonSchema);
    return parseAndValidate(raw);
  }
}

export class OllamaRepairAPI implements ModelRepairAPI {
  constructor(private readonly api: ModelAPI) {}

  async repair(malformed: string): Promise<string> {
    const prompt = buildRepairPrompt(malformed);
    return this.api.generate(prompt, analyzerOutputJsonSchema);
  }
}

function parseAndValidate(raw: string): AnalyzerOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidAnalyzerOutputError(raw);
  }
  const result = AnalyzerOutputSchema.safeParse(parsed);
  if (!result.success) throw new InvalidAnalyzerOutputError(raw);
  return result.data;
}

function buildAnalyzePrompt(draft: string, calibration: Calibration): string {
  const rel =
    calibration.relationship === "unspecified" ? "not specified" : calibration.relationship;
  const goal = calibration.goal === "unspecified" ? "not specified" : calibration.goal;
  const tone =
    calibration.desired_tone === "unspecified" ? "not specified" : calibration.desired_tone;
  return [
    "Draft message:",
    draft,
    "",
    "Calibration:",
    `- Relationship context: ${rel}`,
    `- Communication goal: ${goal}`,
    `- Desired tone: ${tone}`,
    "",
    "Return valid JSON only, with no additional text.",
  ].join("\n");
}

function buildRepairPrompt(malformed: string): string {
  const schema = JSON.stringify(analyzerOutputJsonSchema, null, 2);
  return [
    "The following JSON output does not conform to the required schema.",
    "Correct it and return only valid JSON, with no additional text.",
    "",
    "Required schema:",
    schema,
    "",
    "Invalid output to correct:",
    malformed,
  ].join("\n");
}
