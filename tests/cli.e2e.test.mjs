import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const goldenDir = new URL("./golden/", import.meta.url);

const schema = JSON.parse(
  await readFile(new URL("../schema/message-mirror.v1.schema.json", import.meta.url), "utf8"),
);
const validateJsonSchema = new Ajv2020().compile(schema);

const goldenCases = await discoverGoldenCases();

for (const goldenCase of goldenCases) {
  test(`golden fixture ${goldenCase.name}`, async () => {
    const result = await runCli({
      args: goldenCase.args,
      stdin: goldenCase.stdin,
      scenario: goldenCase.name,
    });

    assert.equal(result.exitCode, goldenCase.exitCode);
    assert.equal(result.stdout, goldenCase.stdout);
    assert.equal(result.stderr, goldenCase.stderr);

    if (goldenCase.stdoutIsJson) {
      const parsed = JSON.parse(result.stdout);
      const valid = validateJsonSchema(parsed);
      assert.ok(
        valid,
        `stdout does not conform to JSON Schema:\n${JSON.stringify(validateJsonSchema.errors, null, 2)}`,
      );
    }

    if (goldenCase.name.startsWith("privacy-")) {
      const draft = goldenCase.stdin.trim();
      if (draft.length > 0) {
        assert.equal(result.stderr.includes(draft), false, "draft must not appear in stderr");
        if (result.stdout.length > 0) {
          const parsed = JSON.parse(result.stdout);
          assert.equal(
            JSON.stringify(parsed.metadata ?? {}).includes(draft),
            false,
            "draft must not appear in metadata",
          );
        }
      }
    }
  });
}

test("schema rejects success output with fewer than 3 alternatives", () => {
  const invalid = {
    schema_version: "message-mirror.v1",
    ok: true,
    metadata: {
      input_source: "stdin",
      privacy: { local_only: true, retained: false },
      calibration: {
        relationship: "unspecified",
        goal: "unspecified",
        desired_tone: "unspecified",
      },
    },
    analysis: {
      apparent_intent: "test",
      emotional_tone: ["neutral"],
      possible_interpretations: ["test"],
      risks_or_ambiguities: [],
      hidden_needs_or_assumptions: [],
    },
    alternatives: [],
  };
  assert.equal(validateJsonSchema(invalid), false, "schema must reject fewer than 3 alternatives");
});

async function discoverGoldenCases() {
  const entries = await readdir(goldenDir, { withFileTypes: true });
  const caseNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.notEqual(caseNames.length, 0, "expected at least one golden fixture");

  return Promise.all(caseNames.map(readGoldenCase));
}

async function readGoldenCase(name) {
  const caseDir = new URL(`${name}/`, goldenDir);
  const [stdin, args] = await Promise.all([
    readFixture(caseDir, "stdin"),
    readFixture(caseDir, "args"),
  ]);

  const stdoutJson = await readOptionalFixture(caseDir, "stdout.json");
  if (stdoutJson !== undefined) {
    return {
      name,
      stdin,
      args: parseArgs(args),
      exitCode: 0,
      stdout: stdoutJson,
      stderr: "",
      stdoutIsJson: true,
    };
  }

  const stdoutPlain = await readOptionalFixture(caseDir, "stdout");
  if (stdoutPlain !== undefined) {
    return {
      name,
      stdin,
      args: parseArgs(args),
      exitCode: 0,
      stdout: stdoutPlain,
      stderr: "",
      stdoutIsJson: false,
    };
  }

  const [stderr, exitText] = await Promise.all([
    readFixture(caseDir, "stderr"),
    readFixture(caseDir, "exit"),
  ]);

  return {
    name,
    stdin,
    args: parseArgs(args),
    exitCode: Number.parseInt(exitText.trim(), 10),
    stdout: "",
    stderr,
  };
}

async function readFixture(caseDir, fileName) {
  return readFile(new URL(fileName, caseDir), "utf8");
}

async function readOptionalFixture(caseDir, fileName) {
  try {
    return await readFixture(caseDir, fileName);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function parseArgs(args) {
  return args.trim().length === 0 ? [] : args.trim().split(/\s+/);
}

function runCli({ args, stdin, scenario }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/cli/main.js", ...args], {
      env: {
        ...process.env,
        MESSAGE_MIRROR_ANALYZER: "fake",
        MESSAGE_MIRROR_FAKE_SCENARIO: scenario,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    child.stdin.end(stdin);
  });
}
