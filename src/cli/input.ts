import type { Readable } from "node:stream";

export function readStdin(stream: Readable = process.stdin): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = "";

    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      input += chunk;
    });
    stream.on("end", () => {
      resolve(input);
    });
    stream.on("error", reject);
  });
}
