// France Travail : tension de recrutement par métier (indicateur PERSP_2).
// POST /v1/indicateur/stat-perspective-employeur — un appel par code ROME.
// API « Marché du travail » (scope SCOPE_STATS = api_ + droit applicatif). Réutilise
// l'OAuth client_credentials (mêmes creds que les Offres, scope différent).
//
// PERSP_2 (nomenclature TYPE_TENSION) renvoie, par période, 8 valeurs :
// 7 facteurs (attractivité salariale, conditions, durabilité, intensité d'embauche,
// main d'œuvre, inadéquation géo, spécificité formation) + la synthèse `PERSPECTIVE`.
// `valeurPrincipaleNombre` = niveau 1→5. On retient la synthèse PERSPECTIVE de la
// période la plus récente.
import type { Env, RawItem } from "../types";
import { getFtAccessToken, SCOPE_STATS } from "./oauth";

const API = "https://api.francetravail.io/partenaire/stats-offres-demandes-emploi/v1";

export interface Territoire {
  type: string; // "NAT" | "REG" | "DEP"
  code: string; // "FR" | code région | code département
}

// Bas niveau : POST brut PERSP_2 pour un code ROME. Accept JSON strict (sinon XML).
export function ftTensionRaw(code: string, terr: Territoire, tok: string): Promise<Response> {
  return fetch(`${API}/indicateur/stat-perspective-employeur`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tok}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      codeTypeTerritoire: terr.type,
      codeTerritoire: terr.code,
      codeTypeActivite: "ROME",
      codeActivite: code,
      codeTypePeriode: "ANNEE",
      codeTypeNomenclature: "TYPE_TENSION",
      dernierePeriode: true, // dernière année seulement
    }),
  });
}

interface StatValeur {
  codeNomenclature?: string;
  libActivite?: string;
  codePeriode?: string;
  libPeriode?: string;
  valeurPrincipaleNombre?: number;
}
interface StatRetour {
  libActivite?: string;
  listeValeursParPeriode?: StatValeur[];
}

// Extrait la synthèse de tension (nomenclature PERSPECTIVE) la plus récente + libellé.
export function parseTension(data: StatRetour): { libelle?: string; niveau?: number; periode?: string } {
  const vals = data.listeValeursParPeriode ?? [];
  const persp = vals.filter((v) => v.codeNomenclature === "PERSPECTIVE");
  let best: StatValeur | undefined;
  for (const v of persp) {
    if (!best || (v.codePeriode ?? "") > (best.codePeriode ?? "")) best = v;
  }
  return {
    libelle: best?.libActivite ?? data.libActivite ?? vals[0]?.libActivite,
    niveau: best?.valeurPrincipaleNombre,
    periode: best?.libPeriode ?? best?.codePeriode,
  };
}

export async function fetchFtTension(
  env: Env,
  codes: string[],
  terr: Territoire,
  nowIso: string
): Promise<RawItem[]> {
  if (!codes.length) return [];
  const tok = await getFtAccessToken(env, SCOPE_STATS);
  const items: RawItem[] = [];

  for (const code of codes) {
    try {
      const res = await ftTensionRaw(code, terr, tok);
      if (res.status !== 200) continue; // 4xx/5xx/429 → skip
      const data = (await res.json()) as StatRetour;
      const { libelle, niveau, periode } = parseTension(data);
      if (niveau == null) continue;
      const label = libelle ?? code;
      items.push({
        url: `https://dataemploi.francetravail.fr/emploi/tensions/FRA/FR?rome=${code}`,
        titre: `${label} (${code}) : tension de recrutement ${niveau}/5 — France Travail`,
        resume: `Indice de tension de recrutement (PERSP_2, « perspectives employeur ») pour le métier ROME ${code} « ${label} » : niveau ${niveau}/5${periode ? ` (${periode})` : ""}, France entière — France Travail, API Marché du travail.`,
        date_pub: nowIso,
      });
    } catch { /* code suivant */ }
  }
  return items;
}
