const GUARDED_FIELDS = [
  ["mt_id", "--mt-id"],
  ["subject.branch", "--branch"],
  ["subject.sha", "--sha"],
  ["subject.base_sha", "--base-sha"],
  ["actor.model", "--actor-model"],
  ["evidence", "--evidence"],
];

function valueAt(event, path) {
  return path.split(".").reduce((value, key) => value?.[key], event);
}

export function assertNoNullTokens(event) {
  for (const [path, flag] of GUARDED_FIELDS) {
    const value = valueAt(event, path);
    if (value !== "null" && value !== "") continue;
    const literal = value === "null" ? 'the 4-character string "null"' : "an empty string";
    throw new Error(
      `${path} is ${literal}, not JSON null. Omit ${flag} entirely when the field is absent ` +
      `(or set "${path}": null in the --json payload). Every nullable field works this way.`,
    );
  }
}
