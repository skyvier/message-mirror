import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidAnalyzerOutputError } from "../../src/analyzer/errors.js";
import { OllamaAnalyzer, OllamaRepairAPI, type ModelAPI } from "../../src/analyzer/ollama.js";
import type { Calibration } from "../../src/cli/calibration.js";

const unspecified: Calibration = {
	relationship: "unspecified",
	goal: "unspecified",
	desired_tone: "unspecified",
};

const validSuccessJson = JSON.stringify({
	schema_version: "message-mirror.v1",
	ok: true,
	metadata: {
		input_source: "stdin",
		privacy: { local_only: true, retained: false },
		calibration: { relationship: "unspecified", goal: "unspecified", desired_tone: "unspecified" },
	},
	analysis: {
		apparent_intent: "Test intent.",
		emotional_tone: ["neutral"],
		possible_interpretations: ["Test interpretation."],
		risks_or_ambiguities: [],
		hidden_needs_or_assumptions: [],
	},
	alternatives: [
		{ label: "direct", text: "Direct.", why: "Why direct." },
		{ label: "warm", text: "Warm.", why: "Why warm." },
		{ label: "boundaried", text: "Boundaried.", why: "Why boundaried." },
	],
});

function stubApi(response: string): ModelAPI {
	return { generate: async () => response };
}

test("OllamaAnalyzer: valid JSON response returns parsed AnalyzerOutput", async () => {
	const analyzer = new OllamaAnalyzer(stubApi(validSuccessJson));
	const result = await analyzer.analyze("Hello", unspecified);
	assert.equal(result.ok, true);
	assert.equal(result.schema_version, "message-mirror.v1");
});

test("OllamaAnalyzer: invalid JSON throws InvalidAnalyzerOutputError", async () => {
	const analyzer = new OllamaAnalyzer(stubApi("not json at all"));
	await assert.rejects(() => analyzer.analyze("Hello", unspecified), InvalidAnalyzerOutputError);
});

test("OllamaAnalyzer: schema-invalid JSON throws InvalidAnalyzerOutputError", async () => {
	const analyzer = new OllamaAnalyzer(stubApi('{"broken": true}'));
	await assert.rejects(() => analyzer.analyze("Hello", unspecified), InvalidAnalyzerOutputError);
});

test("OllamaAnalyzer: network error propagates as plain Error, not InvalidAnalyzerOutputError", async () => {
	const failingApi: ModelAPI = {
		generate: async () => {
			throw new Error("connection refused");
		},
	};
	const analyzer = new OllamaAnalyzer(failingApi);
	await assert.rejects(
		() => analyzer.analyze("Hello", unspecified),
		(err: unknown) => err instanceof Error && !(err instanceof InvalidAnalyzerOutputError),
	);
});

test("OllamaRepairAPI: returns the model API response string", async () => {
	const repairApi = new OllamaRepairAPI(stubApi("repaired output"));
	const result = await repairApi.repair("malformed input");
	assert.equal(result, "repaired output");
});

test("OllamaRepairAPI: repair prompt contains the malformed input", async () => {
	let capturedPrompt = "";
	const capturingApi: ModelAPI = {
		generate: async (prompt) => {
			capturedPrompt = prompt;
			return "{}";
		},
	};
	const repairApi = new OllamaRepairAPI(capturingApi);
	await repairApi.repair("sentinel-malformed-sentinel");
	assert.ok(
		capturedPrompt.includes("sentinel-malformed-sentinel"),
		"repair prompt must include the malformed output",
	);
});
