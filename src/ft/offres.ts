// France Travail : volume d'offres actives par métier dev.
// Un appel Offres par code ROME donne le total (en-tête Content-Range) ET le
// libellé du métier (resultats[0].romeLibelle). La liste des codes est en config
// (éditable), pas figée dans le code.
import type { Env, RawItem } from "../types";
import { getFtAccessToken, SCOPE_OFFRES } from "./oauth";

const API = "https://api.francetravail.io/partenaire";

// nowIso injecté pour rester testable.
export async function fetchFranceTravail(env: Env, codes: string[], nowIso: string): Promise<RawItem[]> {
  if (!codes.length) return [];
  const tok = await getFtAccessToken(env, SCOPE_OFFRES);
  const items: RawItem[] = [];

  for (const code of codes) {
    try {
      const res = await fetch(
        `${API}/offresdemploi/v2/offres/search?codeROME=${encodeURIComponent(code)}&range=0-0`,
        { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } }
      );
      if (res.status !== 200 && res.status !== 206) continue; // 429 & co → skip
      const cr = res.headers.get("content-range"); // "offres 0-0/499"
      const n = cr?.match(/\/(\d+)\s*$/)?.[1];
      if (!n) continue;
      const data = (await res.json()) as { resultats?: { romeLibelle?: string }[] };
      const label = data.resultats?.[0]?.romeLibelle ?? code;
      items.push({
        url: `https://candidat.francetravail.fr/offres/recherche?motsCles=&codeROME=${code}`,
        titre: `${label} (${code}) : ${n} offres actives — France Travail`,
        resume: `Volume d'offres d'emploi actives pour le métier ROME ${code} « ${label} » (source France Travail, API Offres d'emploi).`,
        date_pub: nowIso,
      });
    } catch { /* code suivant */ }
  }
  return items;
}
