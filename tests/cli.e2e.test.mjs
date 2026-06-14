import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const goldenDir = new URL("./golden/", import.meta.url);

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
  });
}

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

  const stdout =
    (await readOptionalFixture(caseDir, "stdout.json")) ??
    (await readOptionalFixture(caseDir, "stdout"));
  if (stdout !== undefined) {
    return {
      name,
      stdin,
      args: parseArgs(args),
      exitCode: 0,
      stdout,
      stderr: "",
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
