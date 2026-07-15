// Prompts curation Deuwi. Voir SPEC.md §6-7.

export const THESE =
  '« L\'IA ne prendra pas ton job. Quelqu\'un qui la dirige mieux que toi, si. » ' +
  "Sans hype, sans déni. Le métier mute, il ne meurt pas.";

const CHAPITRES =
  "1 ce que l'IA sait faire · 2 marché brutal · 3 producteur→directeur de systèmes · " +
  "4 architecture · 5 diriger l'IA · 6 lire/auditer/déboguer · 7 sens produit · " +
  "8 communiquer · 9 apprendre à apprendre · 10 auto-diagnostic · 11 plan 90 jours · " +
  "12 portfolio/CV/entretiens · 13 stratégies par profil · 14 carrière antifragile.";

// Étage 3 — score. Réponse JSON stricte.
export const SCORE_SYSTEM =
  `Tu filtres une veille pour un livre sur la mutation du métier de développeur face à l'IA.\n` +
  `Thèse: ${THESE}\n` +
  `Cible: développeurs et tech leads francophones, 4 profils: junior (silence du marché), ` +
  `confirme (confort=piège), reconverti ("trop tard"), freelance (clients demandent l'IA).\n\n` +
  `Un item ENTRE s'il parle à un profil OU éclaire la mutation du métier. ` +
  `L'appartenance à un chapitre n'est PAS requise pour retenir.\n` +
  `Exclus sans exception: peur artificielle, hype creuse, formations gagne-10k, politique, drama tech, écosystème Apple.\n\n` +
  `Réponds UNIQUEMENT un JSON:\n` +
  `{"pertinent":bool,"chapitre":int|null,"profil":"junior"|"confirme"|"reconverti"|"freelance"|null,` +
  `"chiffres_flag":"ok"|"a_verifier"|"inconnu","score":number}\n` +
  `chiffres_flag: ok=tout chiffre du texte est sourcé dans le texte; a_verifier=chiffre présent mais source imprécise; inconnu=pas de chiffre vérifiable.\n` +
  `Chapitres: ${CHAPITRES}`;

export function scoreUser(titre: string, contenu: string): string {
  return `TITRE: ${titre}\n\nCONTENU:\n${contenu}`;
}

// Étage 4 — draft. Réponse JSON stricte.
export const DRAFT_SYSTEM =
  `Rédige une fiche de veille prête à devenir un angle de post LinkedIn.\n` +
  `Thèse à servir: ${THESE}\n` +
  `Ton: factuel, sans hype, sans peur. Français.\n` +
  `Tout chiffre non sourcé proprement dans le contenu: écris 'À VÉRIFIER' au lieu du chiffre.\n\n` +
  `Réponds UNIQUEMENT un JSON:\n` +
  `{"fait":"1 ligne factuelle + (source, date)","angle":"angle de post concret aligné thèse + le profil ciblé","sources_line":"Sources: <titre> — <url> (<date>)","fait_en":"traduction anglaise fidèle de fait","angle_en":"traduction anglaise fidèle de angle"}\n` +
  `fait_en et angle_en = mêmes contenus que fait et angle, traduits en anglais naturel (garde 'À VÉRIFIER' → 'TO VERIFY').`;

export function draftUser(
  titre: string,
  url: string,
  datePub: string | null,
  chapitre: number | null,
  profil: string | null,
  contenu: string
): string {
  return (
    `TITRE: ${titre}\nURL: ${url}\nDATE: ${datePub ?? "inconnue"}\n` +
    `CHAPITRE rattaché: ${chapitre ?? "aucun"}\nPROFIL ciblé: ${profil ?? "non défini"}\n\n` +
    `CONTENU:\n${contenu}`
  );
}
