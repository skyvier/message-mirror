import { writeFileSync } from "node:fs";
import { toJSONSchema } from "zod";

import { AnalyzerOutputSchema } from "../src/output/schema.js";

const schema = toJSONSchema(AnalyzerOutputSchema);

// Zod's toJSONSchema emits prefixItems for z.tuple but omits minItems/maxItems,
// leaving the alternatives array length unconstrained. The spec requires exactly 3.
const alternatives = (
  (schema as Record<string, unknown>).$defs as Record<string, unknown> | undefined
)?.SuccessOutput as Record<string, unknown> | undefined;
const alternativesProp = (alternatives?.properties as Record<string, unknown> | undefined)
  ?.alternatives as Record<string, unknown> | undefined;
if (alternativesProp) {
  alternativesProp.minItems = 3;
  alternativesProp.maxItems = 3;
  alternativesProp.items = false;
}

const json = `${JSON.stringify(schema, null, 2)}\n`;
writeFileSync("schema/message-mirror.v1.schema.json", json, "utf8");
console.log("Generated schema/message-mirror.v1.schema.json");
