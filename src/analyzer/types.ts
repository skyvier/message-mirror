import type { Calibration } from "../cli/calibration.js";
import type { AnalyzerOutput } from "../output/schema.js";

export interface Analyzer {
  analyze(draft: string, calibration: Calibration): Promise<AnalyzerOutput>;
}
