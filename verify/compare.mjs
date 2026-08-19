const unique = values => [...new Set(values || [])].sort();

export function diffSets(base, head) {
  const a = new Set(base || []);
  const b = new Set(head || []);
  return {
    onlyInBase: unique([...a].filter(value => !b.has(value))),
    onlyInHead: unique([...b].filter(value => !a.has(value))),
    both: unique([...a].filter(value => b.has(value))),
  };
}

const summary = gate => Object.entries(gate.counts).map(([key, value]) => `${key}=${value}`).join(" ");

export function compareGates(baseGates, headGates) {
  return baseGates.map((base, index) => {
    const head = headGates[index];
    const sets = {};
    for (const key of new Set([...Object.keys(base.members), ...Object.keys(head.members)])) {
      sets[key] = diffSets(base.members[key], head.members[key]);
    }
    const added = Object.values(sets).reduce((n, value) => n + value.onlyInHead.length, 0);
    const removed = Object.values(sets).reduce((n, value) => n + value.onlyInBase.length, 0);
    const buildRegression = base.name === "build" && base.ok && !head.ok;
    const untrackedSkipped = !Object.hasOwn(base.members, "skipped_tests")
      ? sets.skipped_tests?.onlyInHead.length || 0 : 0;
    const blockingAdded = base.name === "eslint" ? sets.errors.onlyInHead.length : added - untrackedSkipped;
    let verdict = "SAME";
    if (base.broken || head.broken) verdict = "BROKEN";
    else if (buildRegression || blockingAdded > 0) verdict = `REGRESSED(+${added || 1})`;
    else if (base.name === "eslint" && added && !removed) verdict = `WARN(+${added})`;
    else if (removed && !added) verdict = `IMPROVED(-${removed})`;
    else if (added || removed) verdict = `CHANGED(+${added}/-${removed})`;
    return { name: base.name, base, head, sets, added, removed, verdict,
      regression: buildRegression || blockingAdded > 0, broken: base.broken || head.broken };
  });
}

export function renderComparisons(comparisons) {
  const rows = [["gate", "base", "head", "verdict"], ...comparisons.map(item => [
    item.name, summary(item.base), summary(item.head), item.verdict,
  ])];
  const widths = rows[0].map((_, col) => Math.max(...rows.map(row => row[col].length)));
  const lines = rows.map((row, index) => {
    const line = row.map((cell, col) => cell.padEnd(widths[col])).join(" | ");
    return index === 0 ? `${line}\n${widths.map(n => "-".repeat(n)).join("-+-")}` : line;
  });
  for (const item of comparisons) {
    for (const [set, diff] of Object.entries(item.sets)) {
      const informational = set === "skipped_tests" && !Object.hasOwn(item.base.members, set)
        ? " (informational, non-blocking)" : "";
      if (diff.onlyInHead.length) {
        lines.push(`\n${item.name}.${set} new${informational}:`, ...diff.onlyInHead.map(x => `  + ${x}`));
      }
      if (diff.onlyInBase.length) lines.push(`\n${item.name}.${set} fixed:`, ...diff.onlyInBase.map(x => `  - ${x}`));
    }
    if (item.base.broken) lines.push(`\n${item.name} base BROKEN: ${item.base.brokenReason}`);
    if (item.head.broken) lines.push(`\n${item.name} head BROKEN: ${item.head.brokenReason}`);
  }
  lines.push("", "Legend: WARN is non-blocking; REGRESSED is blocking.");
  return lines.join("\n");
}
