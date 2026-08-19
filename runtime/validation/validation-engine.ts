/**
 * Validation Engine — maps ReportWarning[] to ValidationResult.
 *
 * Blueprint v3.5 §5: Enforcement model. §6: State model.
 * CTO Directive 3.5C: Pure, side-effect free, deterministic.
 *
 * @module 10xs/kernel-runtime/validation/validation-engine
 */

import type {
  ExecutionContractV1,
  ValidationResult,
} from "../schemas/execution-contract";
import type { ReportWarning } from "../reporting/report-generator";
import {
  resolveExecutionContract,
  type ResolveOptions,
} from "../adapter/kernelAdapter";

/** Result of validation including advisory */
export interface ValidationEngineResult {
  validationResult: ValidationResult;
  canTransitionToDone: boolean;
  enforcementMode: "warn" | "block";
}

/** Options for validation */
export interface ValidateReportOptions {
  resolveOptions?: ResolveOptions;
}

/**
 * Validate a completion report against its contract.
 *
 * Maps ReportWarning[] → structured ValidationResult.
 * Applies enforcement mode from kernel spec.
 * Returns advisory canTransitionToDone — caller decides state transition.
 */
export function validateReport(
  contract: ExecutionContractV1,
  warnings: ReportWarning[],
  options?: ValidateReportOptions,
): ValidationEngineResult {
  const rules = resolveExecutionContract(options?.resolveOptions);
  const enforcementMode = rules.microtask.enforcementMode;
  const constraints = rules.microtask;

  const violations = classifyViolations(contract, warnings, constraints);
  const advisoryWarnings = classifyWarnings(warnings, violations);

  const result = determineResult(violations, advisoryWarnings);
  const canTransitionToDone = enforcementMode === "warn" || result !== "fail";

  const validationResult: ValidationResult = {
    result,
    violations,
    warnings: advisoryWarnings,
    validatedAt: new Date().toISOString(),
  };

  return { validationResult, canTransitionToDone, enforcementMode };
}

/** Classify warnings that have numeric constraint violations */
function classifyViolations(
  contract: ExecutionContractV1,
  warnings: ReportWarning[],
  constraints: { maxFiles: number; maxHours: number },
): ValidationResult["violations"] {
  const report = contract.reportingTemplate;
  const violations: ValidationResult["violations"] = [];

  for (const w of warnings) {
    if (w.field === "filesModified" && !w.message.includes("boundaries")) {
      violations.push({
        field: w.field,
        message: w.message,
        actual: report.filesModified.length,
        limit: constraints.maxFiles,
      });
    } else if (w.field === "timeSpentHours") {
      violations.push({
        field: w.field,
        message: w.message,
        actual: report.timeSpentHours,
        limit: constraints.maxHours,
      });
    }
  }

  return violations;
}

/** Classify non-violation warnings (boundary issues, testing, etc.) */
function classifyWarnings(
  warnings: ReportWarning[],
  violations: ValidationResult["violations"],
): ValidationResult["warnings"] {
  const violationKeys = new Set(
    violations.map((v) => `${v.field}:${v.message}`),
  );
  return warnings
    .filter((w) => !violationKeys.has(`${w.field}:${w.message}`))
    .map((w) => ({ field: w.field, message: w.message }));
}

/** Determine pass/warn/fail based on violations and warnings */
function determineResult(
  violations: ValidationResult["violations"],
  warnings: ValidationResult["warnings"],
): "pass" | "warn" | "fail" {
  if (violations.length > 0) return "fail";
  if (warnings.length > 0) return "warn";
  return "pass";
}
