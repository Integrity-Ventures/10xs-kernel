/**
 * Completion Report Generator — populates ReportingTemplate on an ExecutionContractV1.
 *
 * Blueprint v3.5 $4: Completion reports bridge execution and validation.
 * CTO Directive 3.5B: Pure function, headless, no UI.
 *
 * @module 10xs/kernel-runtime/reporting/report-generator
 */

import type {
  ExecutionContractV1,
  ReportingTemplate,
} from "../schemas/execution-contract";
import { ReportingTemplateSchema } from "../schemas/execution-contract";
import { resolveExecutionContract, type ResolveOptions } from "../adapter/kernelAdapter";

/** Warnings generated during report validation */
export interface ReportWarning {
  field: string;
  message: string;
}

/** Result of report generation: updated contract + any warnings */
export interface CompletionReportResult {
  contract: ExecutionContractV1;
  warnings: ReportWarning[];
  submittedAt: string;
}

/** Options for report generation */
export interface GenerateReportOptions {
  resolveOptions?: ResolveOptions;
}

/**
 * Generate a completion report by populating the contract's ReportingTemplate.
 *
 * Validates report data against contract constraints (maxFiles, maxHours)
 * and returns warnings for violations. Does NOT block — validation is
 * informational at this layer (enforcement is Phase 3.5C).
 */
export function generateCompletionReport(
  contract: ExecutionContractV1,
  reportData: Partial<ReportingTemplate>,
  options?: GenerateReportOptions,
): CompletionReportResult {
  const report = ReportingTemplateSchema.parse(reportData);
  const warnings = validateAgainstContract(contract, report, options);
  const submittedAt = new Date().toISOString();

  const updatedContract: ExecutionContractV1 = {
    ...contract,
    reportingTemplate: report,
  };

  return { contract: updatedContract, warnings, submittedAt };
}

/** Validate report data against contract constraints. Returns warnings. */
function validateAgainstContract(
  contract: ExecutionContractV1,
  report: ReportingTemplate,
  options?: GenerateReportOptions,
): ReportWarning[] {
  const warnings: ReportWarning[] = [];
  const rules = resolveExecutionContract(options?.resolveOptions);
  const constraints = rules.microtask;

  if (report.filesModified.length > constraints.maxFiles) {
    warnings.push({
      field: "filesModified",
      message: `Report lists ${report.filesModified.length} files modified, contract allows max ${constraints.maxFiles}`,
    });
  }

  if (report.timeSpentHours > constraints.maxHours) {
    warnings.push({
      field: "timeSpentHours",
      message: `Report lists ${report.timeSpentHours}h spent, contract allows max ${constraints.maxHours}h`,
    });
  }

  if (contract.definition.allowedBoundaries.length > 0) {
    const outOfBounds = report.filesModified.filter(
      (f) => !contract.definition.allowedBoundaries.includes(f),
    );
    if (outOfBounds.length > 0) {
      warnings.push({
        field: "filesModified",
        message: `Files outside allowed boundaries: ${outOfBounds.join(", ")}`,
      });
    }
  }

  if (constraints.requiresTestingStrategy && report.testsAdded === 0) {
    warnings.push({
      field: "testsAdded",
      message: "Contract requires testing strategy but 0 tests reported",
    });
  }

  return warnings;
}
