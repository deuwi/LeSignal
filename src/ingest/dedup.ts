// Normalisation URL + hash pour dedup. Voir SPEC.md §4.

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref_?|source$)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!TRACKING_PARAMS.test(k)) keep.set(k, v);
    }
    u.search = keep.toString();
    let s = u.toString().toLowerCase();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim().toLowerCase();
  }
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function itemHash(url: string, titre: string): Promise<string> {
  const input = normalizeUrl(url) + "|" + normalizeTitle(titre);
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
