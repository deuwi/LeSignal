// Extraction de liens de référence + nettoyage HTML. Voir "liens pour creuser".

function host(u: string): string {
  try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; }
}

const ASSET_RE = /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|mp4|webp)(\?|#|$)/i;
const HREF_RE = /href\s*=\s*["']([^"']+)["']/gi;

// URLs http(s) trouvées dans du HTML. Externes (autre domaine que la source) priorisées.
export function extractLinks(html: string, sourceUrl: string, max = 6): string[] {
  if (!html) return [];
  const found = new Set<string>();
  const srcHost = host(sourceUrl);
  let m: RegExpExecArray | null;
  while ((m = HREF_RE.exec(html)) && found.size < max * 4) {
    const href = m[1].trim().split("#")[0];
    if (!/^https?:\/\//i.test(href)) continue;
    if (ASSET_RE.test(href)) continue;
    if (host(href) === srcHost && href.replace(/\/$/, "") === sourceUrl.replace(/\/$/, "")) continue; // = la source
    found.add(href);
  }
  const arr = [...found];
  arr.sort((a, b) => (host(a) === srcHost ? 1 : 0) - (host(b) === srcHost ? 1 : 0)); // externes d'abord
  return arr.slice(0, max);
}

// Enlève les balises HTML pour un affichage propre du résumé.
export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
