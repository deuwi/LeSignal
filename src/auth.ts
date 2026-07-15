// Garde d'authentification pour les actions d'écriture (app publique).
// Un token secret (ADMIN_TOKEN) est requis dans l'en-tête X-Admin-Token.
import type { Context } from "hono";
import type { Env } from "./types";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Renvoie une Response d'erreur si non autorisé, sinon null.
export function requireAdmin(c: Context<{ Bindings: Env }>): Response | null {
  const expected = c.env.ADMIN_TOKEN ?? "";
  if (!expected) return c.json({ error: "ADMIN_TOKEN non configuré côté serveur" }, 503);
  const token = c.req.header("x-admin-token") ?? "";
  if (!safeEqual(token, expected)) return c.json({ error: "non autorisé" }, 401);
  return null;
}
