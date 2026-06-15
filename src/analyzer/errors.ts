export class InvalidAnalyzerOutputError extends Error {
  constructor(public readonly raw: string) {
    super("invalid analyzer output");
  }
}

export class RepairExhaustedError extends Error {
  constructor(public readonly attempts: number) {
    super(`repair exhausted after ${attempts} attempts`);
  }
}
