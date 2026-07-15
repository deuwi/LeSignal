// Garde-fou "1 passe / jour" via app_state.
import type { Env } from "./types";

export async function ranWithin(env: Env, key: string, hours: number): Promise<boolean> {
  const row = await env.DB.prepare("SELECT value FROM app_state WHERE key=?").bind(key).first<{ value: string }>();
  if (!row?.value) return false;
  const last = Date.parse(row.value.replace(" ", "T") + "Z");
  return Number.isFinite(last) && Date.now() - last < hours * 3_600_000;
}

export async function stamp(env: Env, key: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO app_state (key, value) VALUES (?, datetime('now')) " +
    "ON CONFLICT(key) DO UPDATE SET value=datetime('now')"
  ).bind(key).run();
}
