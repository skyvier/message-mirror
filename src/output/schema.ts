import { z } from "zod";

import { desiredToneValues, goalValues, relationshipValues } from "../cli/calibration.js";

const PrivacySchema = z
  .object({
    local_only: z.literal(true),
    retained: z.literal(false),
  })
  .meta({ id: "Privacy" });

const CalibrationOutputSchema = z
  .object({
    relationship: z.enum([...relationshipValues, "unspecified"]),
    goal: z.enum([...goalValues, "unspecified"]),
    desired_tone: z.enum([...desiredToneValues, "unspecified"]),
  })
  .meta({ id: "Calibration" });

const MetadataSchema = z
  .object({
    input_source: z.literal("stdin"),
    privacy: PrivacySchema,
    calibration: CalibrationOutputSchema,
  })
  .meta({ id: "Metadata" });

const AnalysisSchema = z
  .object({
    apparent_intent: z.string().min(1),
    emotional_tone: z.array(z.string().min(1)).min(1),
    possible_interpretations: z.array(z.string().min(1)).min(1),
    risks_or_ambiguities: z.array(z.string().min(1)),
    hidden_needs_or_assumptions: z.array(z.string().min(1)),
  })
  .meta({ id: "Analysis" });

export const SuccessOutputSchema = z
  .object({
    schema_version: z.literal("message-mirror.v1"),
    ok: z.literal(true),
    metadata: MetadataSchema,
    analysis: AnalysisSchema,
    alternatives: z.tuple([
      z.object({ label: z.literal("direct"), text: z.string().min(1), why: z.string().min(1) }),
      z.object({ label: z.literal("warm"), text: z.string().min(1), why: z.string().min(1) }),
      z.object({
        label: z.literal("boundaried"),
        text: z.string().min(1),
        why: z.string().min(1),
      }),
    ]),
  })
  .meta({ id: "SuccessOutput" });

const RefusalCategorySchema = z.enum([
  "manipulation",
  "coercion",
  "deception",
  "guilt_pressure",
  "jealousy_induction",
  "threat",
  "harassment",
  "consent_evasion",
  "exploitation",
  "unsafe_other",
]);

export const RefusalOutputSchema = z
  .object({
    schema_version: z.literal("message-mirror.v1"),
    ok: z.literal(false),
    metadata: MetadataSchema,
    refusal: z
      .object({
        category: RefusalCategorySchema,
        reason: z.string().min(1),
        safer_frame: z.string().min(1),
      })
      .meta({ id: "Refusal" }),
  })
  .meta({ id: "RefusalOutput" });

export const AnalyzerOutputSchema = z.discriminatedUnion("ok", [
  SuccessOutputSchema,
  RefusalOutputSchema,
]);

export type SuccessOutput = z.infer<typeof SuccessOutputSchema>;
export type RefusalOutput = z.infer<typeof RefusalOutputSchema>;
export type AnalyzerOutput = z.infer<typeof AnalyzerOutputSchema>;
