import type { Readable } from "node:stream";
import { RepairExhaustedError } from "../analyzer/errors.js";
import { createFakeAnalyzer, createFakeRepairApi } from "../analyzer/fake.js";
import { OllamaAnalyzer, OllamaModelAPI, OllamaRepairAPI } from "../analyzer/ollama.js";
import { RepairingAnalyzer } from "../analyzer/repairing.js";
import type { Analyzer } from "../analyzer/types.js";
import { formatJson } from "../output/format.js";
import { parseCliArgs } from "./args.js";
import { readStdin } from "./input.js";

export interface IO {
	stdin: Readable;
	stdout: { write(data: string): void };
	stderr: { write(data: string): void };
	setExitCode(code: number): void;
}

const maxDraftLength = 10_000;
const analyzerEnvName = "MESSAGE_MIRROR_ANALYZER";
const fakeScenarioEnvName = "MESSAGE_MIRROR_FAKE_SCENARIO";
const ollamaUrlEnvName = "MESSAGE_MIRROR_OLLAMA_URL";
const modelEnvName = "MESSAGE_MIRROR_MODEL";
const defaultOllamaUrl = "http://127.0.0.1:11434";
const defaultModel = "message-mirror";

export async function runCli(args: string[], io: IO, injectAnalyzer?: Analyzer): Promise<void> {
	const calibrationResult = parseCliArgs(args);
	if (!calibrationResult.ok) {
		if (calibrationResult.kind === "stdout") {
			io.stdout.write(calibrationResult.message);
			return;
		}
		writeError(io, calibrationResult.message);
		return;
	}

	const draft = (await readStdin(io.stdin)).trim();
	if (draft.length === 0) {
		writeError(io, "error: draft message is empty");
		return;
	}

	if (draft.length > maxDraftLength) {
		writeError(io, "error: draft message exceeds 10000 characters");
		return;
	}

	const analyzer = injectAnalyzer ?? buildAnalyzer();

	try {
		const output = await analyzer.analyze(draft, calibrationResult.calibration);
		// Runtime schema validation and repair happen inside RepairingAnalyzer.
		// runCli trusts the Analyzer interface contract: returns AnalyzerOutput or throws.
		io.stdout.write(formatJson(output));
	} catch (error) {
		if (error instanceof RepairExhaustedError) {
			writeError(
				io,
				`error: analyzer returned invalid schema after ${error.attempts} repair attempts`,
			);
		} else {
			writeError(io, "error: local analyzer backend unavailable");
		}
	}
}

function buildAnalyzer(): Analyzer {
	if (process.env[analyzerEnvName] === "fake") {
		const scenario = process.env[fakeScenarioEnvName];
		return new RepairingAnalyzer(createFakeAnalyzer(scenario), createFakeRepairApi(scenario));
	}
	const url = process.env[ollamaUrlEnvName] ?? defaultOllamaUrl;
	const model = process.env[modelEnvName] ?? defaultModel;
	const api = new OllamaModelAPI(url, model);
	return new RepairingAnalyzer(new OllamaAnalyzer(api), new OllamaRepairAPI(api));
}

function writeError(io: IO, message: string): void {
	io.stderr.write(`${message}\n`);
	io.setExitCode(1);
}
