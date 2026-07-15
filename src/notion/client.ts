// Client minimal API Notion (Workers fetch). Voir SPEC.md §9.
import type { Env } from "../types";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

function headers(env: Env) {
  return {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    "Notion-Version": VERSION,
    "content-type": "application/json",
  };
}

export interface NotionProps {
  fait: string;
  angle: string;
  chapitre: number | null;
  profil: string | null;
  chiffres_flag: string | null;
  url: string;
  date_pub: string | null;
}

// Mapping vers propriétés Notion (noms = schéma SPEC §9, doivent matcher la base).
const PROFIL_LABEL: Record<string, string> = {
  junior: "junior", confirme: "confirmé", reconverti: "reconverti", freelance: "freelance",
};
const CHIFFRES_LABEL: Record<string, string> = {
  ok: "OK", a_verifier: "À vérifier", inconnu: "Inconnu",
};

function buildProperties(p: NotionProps) {
  const props: Record<string, unknown> = {
    "Fait": { title: [{ text: { content: p.fait.slice(0, 2000) } }] },
    "Angle": { rich_text: [{ text: { content: p.angle.slice(0, 2000) } }] },
    "Statut": { select: { name: "À écrire" } },
    "Chapitre": { select: { name: p.chapitre ? String(p.chapitre) : "aucun" } },
  };
  if (p.profil && PROFIL_LABEL[p.profil]) props["Profil"] = { select: { name: PROFIL_LABEL[p.profil] } };
  if (p.chiffres_flag && CHIFFRES_LABEL[p.chiffres_flag]) props["Chiffres"] = { select: { name: CHIFFRES_LABEL[p.chiffres_flag] } };
  if (p.url) props["Source"] = { url: p.url };
  if (p.date_pub) props["Date fait"] = { date: { start: p.date_pub.slice(0, 10) } };
  return props;
}

export async function createPage(env: Env, p: NotionProps): Promise<string> {
  const res = await fetch(`${API}/pages`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ parent: { database_id: env.NOTION_DB_ID }, properties: buildProperties(p) }),
  });
  if (!res.ok) throw new Error(`Notion create ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updatePage(env: Env, pageId: string, p: NotionProps): Promise<void> {
  const res = await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(env),
    body: JSON.stringify({ properties: buildProperties(p) }),
  });
  if (!res.ok) throw new Error(`Notion update ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
