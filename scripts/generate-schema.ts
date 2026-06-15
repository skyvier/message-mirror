import { writeFileSync } from "node:fs";
import { toJSONSchema } from "zod";

import { AnalyzerOutputSchema } from "../src/output/schema.js";

const schema = toJSONSchema(AnalyzerOutputSchema);
const json = `${JSON.stringify(schema, null, 2)}\n`;
writeFileSync("schema/message-mirror.v1.schema.json", json, "utf8");
console.log("Generated schema/message-mirror.v1.schema.json");
