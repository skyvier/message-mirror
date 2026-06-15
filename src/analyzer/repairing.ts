import type { Calibration } from "../cli/calibration.js";
import { AnalyzerOutputSchema, type AnalyzerOutput } from "../output/schema.js";
import { InvalidAnalyzerOutputError, RepairExhaustedError } from "./errors.js";
import type { Analyzer } from "./types.js";

export interface ModelRepairAPI {
  repair(malformed: string): Promise<string>;
}

const maxRepairAttempts = 3;

export class RepairingAnalyzer implements Analyzer {
  constructor(
    private readonly inner: Analyzer,
    private readonly repairApi: ModelRepairAPI,
  ) {}

  async analyze(draft: string, calibration: Calibration): Promise<AnalyzerOutput> {
    try {
      return await this.inner.analyze(draft, calibration);
    } catch (error) {
      if (!(error instanceof InvalidAnalyzerOutputError)) throw error;
      return this.attemptRepairs(error.raw);
    }
  }

  private async attemptRepairs(initial: string): Promise<AnalyzerOutput> {
    let malformed = initial;
    for (let attempt = 0; attempt < maxRepairAttempts; attempt++) {
      const repaired = await this.repairApi.repair(malformed);
      const parsed = tryParseAnalyzerOutput(repaired);
      if (parsed !== null) return parsed;
      malformed = repaired;
    }
    throw new RepairExhaustedError(maxRepairAttempts);
  }
}

function tryParseAnalyzerOutput(raw: string): AnalyzerOutput | null {
  try {
    const result = AnalyzerOutputSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
