import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("fake analyzer success emits calibrated v1 JSON from stdin", async () => {
  const result = await runCli({
    args: ["--relationship", "friend", "--goal", "apology", "--desired-tone", "warm"],
    stdin: "  I am sorry I was short with you yesterday.  \n",
    env: {
      MESSAGE_MIRROR_ANALYZER: "fake",
      MESSAGE_MIRROR_FAKE_SCENARIO: "success-calibrated",
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `${JSON.stringify(
      {
        schema_version: "message-mirror.v1",
        ok: true,
        metadata: {
          input_source: "stdin",
          privacy: {
            local_only: true,
            retained: false,
          },
          calibration: {
            relationship: "friend",
            goal: "apology",
            desired_tone: "warm",
          },
        },
        analysis: {
          apparent_intent: "Apologize for a tense moment and reopen the conversation respectfully.",
          emotional_tone: ["accountable", "warm"],
          possible_interpretations: [
            "The recipient may hear a clear apology without pressure to respond immediately.",
          ],
          risks_or_ambiguities: [],
          hidden_needs_or_assumptions: [],
        },
        alternatives: [
          {
            label: "direct",
            text: "I am sorry I was short with you yesterday. That was unfair, and I will handle it differently next time.",
            why: "Names the apology plainly and keeps responsibility with the sender.",
          },
          {
            label: "warm",
            text: "I am sorry I was short with you yesterday. I care about our friendship and did not want to leave it there.",
            why: "Adds care while preserving the apology.",
          },
          {
            label: "boundaried",
            text: "I am sorry I was short with you yesterday. I wanted to acknowledge it, and there is no pressure to respond right away.",
            why: "Offers repair while respecting the recipient's autonomy.",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
});

function runCli({ args, stdin, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/cli/main.js", ...args], {
      env: { ...process.env, ...env },
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
