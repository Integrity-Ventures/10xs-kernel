// RG008 measures the presence of evidence, never its quality or truthfulness.
// Five prose lines and one non-empty pasted block are a deliberately low floor:
// real reports clear it trivially, while empty reports cannot. Whether evidence
// proves a claim is the validating architect's judgment and is not mechanisable.
import {
  NARRATIVE_BOILERPLATE_LINES,
  NARRATIVE_HEADING,
  splitAtNarrativeHeading,
} from './report-facts.mjs';

function finding(file, message) {
  return { code: 'RG008', file, message };
}

function inspectNarrative(narrative) {
  let inFence = false;
  let fenceHasOutput = false;
  let hasPastedOutput = false;
  const prose = [];

  for (const line of narrative.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (inFence) hasPastedOutput ||= fenceHasOutput;
      inFence = !inFence;
      fenceHasOutput = false;
      continue;
    }
    if (inFence) {
      fenceHasOutput ||= line.trim().length > 0;
    } else if (line.trim() && !NARRATIVE_BOILERPLATE_LINES.includes(line)) {
      prose.push(line);
    }
  }
  return { proseLines: prose.length, hasPastedOutput };
}

export function checkRG008(reportText, file) {
  const { narrative, hasHeading } = splitAtNarrativeHeading(reportText);
  if (!hasHeading) {
    return [finding(file, `RG008a: report has no ${NARRATIVE_HEADING} heading; no executor evidence is offered`)];
  }

  const { proseLines, hasPastedOutput } = inspectNarrative(narrative);
  const findings = [];
  if (proseLines < 5) {
    findings.push(finding(file, `RG008b: narrative is too thin; found ${proseLines} prose lines, need at least 5`));
  }
  if (!hasPastedOutput) {
    findings.push(finding(file, 'RG008c: narrative has no fenced block containing non-blank pasted output'));
  }
  return findings;
}
