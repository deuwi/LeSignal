// Garde d'authentification pour les actions d'écriture (app publique).
// Un token secret (ADMIN_TOKEN) est requis dans l'en-tête X-Admin-Token.
import type { Context } from "hono";
import type { Env } from "./types";

// Comparaison à temps constant, sans fuite de longueur:
// on compare les empreintes SHA-256 (taille fixe) des deux chaînes.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha), vb = new Uint8Array(hb);
  let out = 0;
  for (let i = 0; i < va.length; i++) out |= va[i] ^ vb[i];
  return out === 0;
}

// Renvoie une Response d'erreur si non autorisé, sinon null.
export async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  const expected = c.env.ADMIN_TOKEN ?? "";
  if (!expected) return c.json({ error: "ADMIN_TOKEN non configuré côté serveur" }, 503);
  const token = c.req.header("x-admin-token") ?? "";
  if (!(await safeEqual(token, expected))) return c.json({ error: "non autorisé" }, 401);
  return null;
}
