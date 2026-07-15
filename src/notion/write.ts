// Écriture Notion (création de page). Voir SPEC.md §9.
// Schéma base "Veille": Fait(title), Angle/Chapitre/Profil/Chiffres(text), Source(url).
import type { Env } from "../types";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

const PROFIL_LABEL: Record<string, string> = {
  junior: "junior", confirme: "confirmé", reconverti: "reconverti", freelance: "freelance",
};
const CHIFFRES_LABEL: Record<string, string> = {
  ok: "OK", a_verifier: "À vérifier", inconnu: "Inconnu",
};

export interface FicheProps {
  fait: string;
  angle: string;
  chapitre: number | null;
  profil: string | null;
  chiffres_flag: string | null;
  url: string;
}

function text(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}

// Crée une page dans la base et renvoie son id.
export async function createNotionPage(env: Env, p: FicheProps): Promise<string> {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) throw new Error("NOTION_TOKEN / NOTION_DB_ID absents");

  const properties: Record<string, unknown> = {
    "Fait": { title: [{ text: { content: p.fait.slice(0, 2000) } }] },
    "Angle": text(p.angle),
    "Chapitre": text(p.chapitre ? String(p.chapitre) : "aucun"),
    "Profil": text(p.profil ? PROFIL_LABEL[p.profil] ?? p.profil : ""),
    "Chiffres": text(p.chiffres_flag ? CHIFFRES_LABEL[p.chiffres_flag] ?? p.chiffres_flag : ""),
  };
  if (p.url) properties["Source"] = { url: p.url };

  const res = await fetch(`${API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: env.NOTION_DB_ID }, properties }),
  });
  if (!res.ok) throw new Error(`Notion create ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { id: string }).id;
}
