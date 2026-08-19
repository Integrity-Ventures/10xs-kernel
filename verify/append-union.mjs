const lines = (text) => {
  const values = text.split('\n').map((line) => line.endsWith('\r') ? line.slice(0, -1) : line);
  while (values.at(-1) === '') values.pop();
  return values;
};

export function assertAppendUnion(path, oursText, theirsText, mergedText) {
  const ours = new Set(lines(oursText));
  const theirs = new Set(lines(theirsText));
  const mergedLines = lines(mergedText);
  const merged = new Set(mergedLines);
  // merged == ours + theirs - base is wrong because independently added overlapping lines get counted twice.
  const expected = new Set([...ours, ...theirs]);
  const lost = [...expected].filter((line) => !merged.has(line));
  const invented = [...merged].filter((line) => !expected.has(line));
  const counts = new Map();
  for (const line of mergedLines) counts.set(line, (counts.get(line) || 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([line, count]) => ({ line, count }));
  return { path, ok: lost.length === 0 && invented.length === 0, lost, invented, duplicates };
}
