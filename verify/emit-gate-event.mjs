import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function schemaShapeValid(event, schema) {
  const keys = ["schema", "ts", "round", "project", "mt_id", "kind", "actor", "subject", "claim",
    "observed", "evidence", "notes"];
  const allowed = new Set(schema.required || keys);
  return Object.keys(event).length === allowed.size && [...allowed].every(key => key in event) &&
    event.schema === "10xs.event/1" && event.kind === "gate_compare" &&
    /^\d{8}-[a-z0-9][a-z0-9-]*$/.test(event.round) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(event.ts) &&
    event.project.length > 0 && (event.mt_id === null || event.mt_id.length > 0) && event.claim === null &&
    event.actor.kind === "agent" && typeof event.actor.machine === "string" && typeof event.actor.role === "string" &&
    event.subject && Object.keys(event.subject).sort().join() === "base_sha,branch,sha" &&
    Object.values(event.observed)
      .every(value => ["string", "number", "boolean"].includes(typeof value) || value === null);
}

export function emitGateEvent({ eventDir, round, mtId, headRef, headSha, baseSha, observed,
  actorModel, actorMachine = "fleetbox", actorRole = "coding-assistant", project = "10xs-kernel" }) {
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const event = {
    schema: "10xs.event/1", ts, round, project, mt_id: mtId || null,
    kind: "gate_compare",
    actor: { kind: "agent", model: actorModel ?? null, machine: actorMachine, role: actorRole },
    subject: { branch: headRef, sha: headSha, base_sha: baseSha }, claim: null, observed,
    evidence: null, notes: "",
  };
  const schema = join(eventDir, "schema/event.v1.schema.json");
  if (existsSync(schema)) {
    const contract = JSON.parse(readFileSync(schema, "utf8"));
    if (!schemaShapeValid(event, contract)) throw new Error(`event refused: does not conform to ${schema}`);
  }
  const dir = join(eventDir, round);
  mkdirSync(dir, { recursive: true });
  const stamp = ts.replaceAll(":", "-");
  const stem = `${stamp}__${mtId || "scope"}__gate_compare`;
  let path = join(dir, `${stem}.json`), suffix = 2;
  while (existsSync(path)) path = join(dir, `${stem}-${suffix++}.json`);
  writeFileSync(path, `${JSON.stringify(event, null, 2)}\n`, { flag: "wx" });
  return { path, schemaValidated: existsSync(schema) };
}
