// OAuth2 client_credentials France Travail (partenaire).
// Host historique Pôle emploi (entreprise.francetravail.io = NXDOMAIN).
import type { Env } from "../types";

const TOKEN_URL =
  "https://entreprise.pole-emploi.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";

// Scopes confirmés en prod.
export const SCOPE_OFFRES = "api_offresdemploiv2 o2dsoffre";
export const SCOPE_ROME = "api_rome-metiersv1 nomenclatureRome";

export async function getFtAccessToken(env: Env, scope: string): Promise<string> {
  if (!env.FT_CLIENT_ID || !env.FT_CLIENT_SECRET) throw new Error("FT creds absents");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.FT_CLIENT_ID,
    client_secret: env.FT_CLIENT_SECRET,
    scope,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`FT token ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("FT token: pas d'access_token");
  return j.access_token;
}
