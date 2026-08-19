/**
 * JSON Schema Export from Zod Definitions (v3.5D)
 *
 * Converts kernel-runtime Zod schemas to JSON Schema format
 * for the Governance Pack SCHEMAS/ directory.
 *
 * CTO Decision 2: Generated from Zod — no hand-authored schemas.
 * Resolves Zod v4's toJSONSchema() at call time so Zod v3 consumers can
 * bundle the kernel without invoking this v4-only exporter.
 *
 * @module 10xs/kernel-runtime/governance/schema-exporter
 */

import * as z from "zod";
import { ExecutionContractV1Schema } from "../schemas/execution-contract";
import { Phase1ResultSchema, Phase2ResultSchema } from "../schemas/agile-hierarchy";

/** Exported JSON Schema bundle with metadata */
export interface SchemaExport {
  /** JSON Schema $id for the schema bundle */
  $id: string;
  /** Human-readable title */
  title: string;
  /** Generation timestamp (ISO 8601) */
  generatedAt: string;
  /** Source Zod schema name(s) */
  sourceSchema: string;
  /** The JSON Schema object */
  schema: Record<string, unknown>;
}

interface ExportOptions {
  now?: Date;
}

/**
 * Export ExecutionContractV1 as JSON Schema.
 * Includes sub-schemas (ValidationResult, ReportingTemplate,
 * ContractDefinition) inline via Zod composition.
 */
export function exportExecutionContractSchema(
  options?: ExportOptions,
): SchemaExport {
  const toJSONSchema = Reflect.get(z, "toJSONSchema") as unknown;
  if (typeof toJSONSchema !== "function") {
    throw new Error(
      "schema-exporter requires zod v4's toJSONSchema; the installed zod is v3. " +
        "Upgrade zod or stop calling this exporter.",
    );
  }
  const schema = toJSONSchema(ExecutionContractV1Schema) as Record<string, unknown>;
  const generatedAt = (options?.now ?? new Date()).toISOString();

  return {
    $id: "governance/schemas/execution_contract",
    title: "ExecutionContract V1",
    generatedAt,
    sourceSchema: "ExecutionContractV1Schema",
    schema,
  };
}

/**
 * Export decomposition hierarchy as JSON Schema.
 * Bundles Phase1Result and Phase2Result with their nested
 * Epic → Story → Microtask hierarchy as $defs.
 */
export function exportReportingSchema(
  options?: ExportOptions,
): SchemaExport {
  const toJSONSchema = Reflect.get(z, "toJSONSchema") as unknown;
  if (typeof toJSONSchema !== "function") {
    throw new Error(
      "schema-exporter requires zod v4's toJSONSchema; the installed zod is v3. " +
        "Upgrade zod or stop calling this exporter.",
    );
  }
  const phase1 = toJSONSchema(Phase1ResultSchema) as Record<string, unknown>;
  const phase2 = toJSONSchema(Phase2ResultSchema) as Record<string, unknown>;
  const generatedAt = (options?.now ?? new Date()).toISOString();

  const schema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $defs: {
      Phase1Result: phase1,
      Phase2Result: phase2,
    },
  };

  return {
    $id: "governance/schemas/reporting",
    title: "Decomposition Reporting",
    generatedAt,
    sourceSchema: "Phase1ResultSchema, Phase2ResultSchema",
    schema,
  };
}
