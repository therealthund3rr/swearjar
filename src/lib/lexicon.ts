// Built-in word list (IT + EN): the no-network prefilter and the no-key fallback judge (CLAUDE.md §3.2).
// Pure module, also imported by the browser. The AI judge is the real brain; this only has to be fast and predictable.
import type { BaseTierId, RuleSet, VerdictHit } from "./rules";

/** Words that are never fined, whatever the house rules say (CLAUDE.md §3.2). */
export const BUILTIN_FREE_WORDS = ["cavolo", "mannaggia", "accidenti", "porca miseria", "fudge", "shoot", "darn", "gosh", "heck"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", $: "s", "5": "s", "7": "t" };

type Folded = { s: string; start: number[]; end: number[] };

/**
 * Lowercase, strip accents, map leetspeak, keep `*` (wildcard), everything else becomes one space.
 * Keeps, for each output char, the [start,end) range in the original text so a match can quote the
 * exact original substring. `all` collapses every repeated letter run to one letter (used for
 * matching, applied to the roots too); otherwise only runs of 3+ collapse (the public normalizeText).
 */
function fold(text: string, all: boolean): Folded {
  const chars: string[] = [];
  const st: number[] = [];
  const en: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const d0 of text[i].normalize("NFD")) {
      if (/[̀-ͯ]/.test(d0)) continue;
      const d = d0.toLowerCase();
      const c = LEET[d] ?? d;
      if (/^[a-z*]$/.test(c)) {
        chars.push(c);
        st.push(i);
        en.push(i + 1);
      } else if (chars.length && chars[chars.length - 1] !== " ") {
        chars.push(" ");
        st.push(i);
        en.push(i + 1);
      }
    }
  }
  while (chars.length && chars[chars.length - 1] === " ") {
    chars.pop();
    st.pop();
    en.pop();
  }
  const out: Folded = { s: "", start: [], end: [] };
  let i = 0;
  while (i < chars.length) {
    let j = i;
    while (j + 1 < chars.length && chars[j + 1] === chars[i] && chars[i] !== " " && chars[i] !== "*") j++;
    const run = j - i + 1;
    if (all || run >= 3) {
      out.s += chars[i];
      out.start.push(st[i]);
      out.end.push(en[j]);
    } else {
      for (let k = i; k <= j; k++) {
        out.s += chars[k];
        out.start.push(st[k]);
        out.end.push(en[k]);
      }
    }
    i = j + 1;
  }
  return out;
}

/** "C4ZZZZO" -> "cazo", "Perché" -> "perche". Keeps `*`. */
export function normalizeText(s: string): string {
  return fold(s, false).s;
}

/** "cazzo" -> "c***o"; "porco dio" -> "p*******o"; two chars or fewer -> "*". */
export function maskWord(word: string): string {
  const cs = [...word.trim()];
  if (cs.length <= 2) return "*";
  return cs[0] + "*".repeat(cs.length - 2) + cs[cs.length - 1];
}

type Root = { root: string; tier: BaseTierId; alt?: string; prefix?: boolean; forms?: string[] };

const r = (root: string, tier: BaseTierId, alt?: string, o: { p?: boolean; f?: string[] } = {}): Root => ({
  root,
  tier,
  alt,
  prefix: o.p,
  forms: o.f,
});

/*
 * Matching policy (per root): whole word by default, so "ass" never hits "classic" or "assistant".
 * Inflections are listed explicitly in `f`. Roots flagged `p` also match any word that STARTS with
 * the root (unambiguous stems like "stronz" -> stronzata). "scazzottata" does not start with "cazz",
 * so it is left alone. A lone letter in a multi-word root ("porco d", "dio c") is a dodge: it only
 * matches a single-letter word, never "d'accordo". Multi-word roots win over their single-word parts
 * ("madonna puttana" is blasphemy, not just "puttana").
 */
const ROOTS: Root[] = [
  // First on purpose: on a tie ("f***") the earlier root wins, and "fuck" is far likelier than "figa".
  r("fuck", "strong", "fudge", { p: true, f: ["fucking", "fucked", "fucker", "fuckers", "fucks"] }),
  // Italian blasphemy
  r("porco dio", "blasphemy", "porca miseria"),
  r("porcodio", "blasphemy", "porca miseria"),
  r("porco d", "blasphemy", "porca miseria"),
  r("dio porco", "blasphemy", "porca miseria"),
  r("dio cane", "blasphemy", "porca miseria"),
  r("diocane", "blasphemy", "porca miseria"),
  r("dio c", "blasphemy", "porca miseria"),
  r("dio boia", "blasphemy", "porca miseria"),
  r("dio bestia", "blasphemy", "porca miseria"),
  r("dio merda", "blasphemy", "porca miseria"),
  r("dio maiale", "blasphemy", "porca miseria"),
  r("dio bastardo", "blasphemy", "porca miseria"),
  r("dio stronzo", "blasphemy", "porca miseria"),
  r("porca madonna", "blasphemy", "porca miseria"),
  r("madonna puttana", "blasphemy", "porca miseria"),
  r("madonna troia", "blasphemy", "porca miseria"),
  r("madonna porca", "blasphemy", "porca miseria"),
  r("madonna maiala", "blasphemy", "porca miseria"),
  r("madonna bastarda", "blasphemy", "porca miseria"),
  r("porco cristo", "blasphemy", "porca miseria"),
  r("porco gesu", "blasphemy", "porca miseria"),
  // Italian strong
  r("cazzo", "strong", "cavolo", { p: true, f: ["cazzi"] }),
  r("cazzata", "strong", "sciocchezza", { f: ["cazzate"] }),
  r("minchia", "strong", "caspita", { f: ["minchione", "minchiate", "minchiata"] }),
  r("merda", "strong", "mannaggia", { f: ["merde", "merdoso", "merdosa"] }),
  r("stronzo", "strong", "sciocco", { f: ["stronza", "stronzi", "stronze", "stronzata", "stronzate"] }),
  r("vaffanculo", "strong", "vai a quel paese", { p: true }),
  r("fanculo", "strong", "accidenti", { p: true }),
  r("coglione", "strong", "sbadato", { f: ["coglioni", "coglionata"] }),
  r("rompicoglioni", "strong", "seccatore", { p: true }),
  r("puttana", "strong", "peste", { f: ["puttane", "puttanata", "puttanate"] }),
  r("porca troia", "strong", "porca miseria"),
  r("troia", "strong", undefined, { f: ["troie"] }),
  r("zoccola", "strong", undefined, { f: ["zoccole"] }),
  r("mignotta", "strong", undefined, { f: ["mignotte"] }),
  r("baldracca", "strong"),
  r("figa", "strong", undefined, { f: ["fighe"] }),
  r("sticazzi", "strong", "chissenefrega", { p: true }),
  r("stocazzo", "strong", "caspita", { p: true }),
  r("mortacci", "strong", "accidenti", { p: true }),
  // Italian mild and regional
  r("vaffa", "mild", "accidenti"),
  r("culo", "mild", undefined, { f: ["culi"] }),
  r("palle", "mild", "scatole"),
  r("incazzato", "mild", "arrabbiato", { p: true }),
  r("cagata", "mild", "sciocchezza", { f: ["cagate"] }),
  r("bastardo", "mild", "furfante", { f: ["bastarda", "bastardi"] }),
  r("pirla", "mild", "sciocco"),
  r("maronna", "mild", "mamma mia"),
  r("belin", "mild", "caspita"),
  // English strong
  r("motherfucker", "strong", "sucker", { p: true }),
  r("shit", "strong", "shoot", { f: ["shitty", "shits", "shitting", "shite"] }),
  r("bullshit", "strong", "baloney", { p: true }),
  r("bitch", "strong", "witch", { f: ["bitches", "bitchy"] }),
  r("son of a bitch", "strong", "son of a gun"),
  r("asshole", "strong", "jerk", { f: ["assholes"] }),
  r("dick", "strong", "jerk", { f: ["dicks", "dickhead"] }),
  r("cunt", "strong", undefined, { f: ["cunts"] }),
  r("twat", "strong"),
  r("prick", "strong", "jerk"),
  r("slut", "strong"),
  r("whore", "strong"),
  // English mild
  r("damn", "mild", "darn", { f: ["damned", "dammit", "goddamn", "goddamned"] }),
  r("crap", "mild", "crud", { f: ["crappy"] }),
  r("ass", "mild", "butt", { f: ["asses", "jackass", "dumbass"] }),
  r("bastard", "mild", "rascal", { f: ["bastards"] }),
  r("piss", "mild", "tick", { f: ["pissed", "pissing"] }),
  r("wtf", "mild", "what the heck"),
  r("bollocks", "mild", "nonsense"),
  r("douche", "mild", "jerk", { f: ["douchebag"] }),
  // Slurs: deliberately short, never echoed back (the UI shows "hateful language")
  r("nigger", "slur", undefined, { f: ["niggers", "nigga", "niggas"] }),
  r("faggot", "slur", undefined, { f: ["faggots"] }),
  r("retard", "slur", undefined, { f: ["retarded", "retards"] }),
  r("tranny", "slur"),
  r("chink", "slur"),
  r("kike", "slur"),
  r("spic", "slur"),
  r("frocio", "slur", undefined, { f: ["froci"] }),
  r("ricchione", "slur", undefined, { f: ["ricchioni"] }),
];

type Compiled = { root: Root; words: string[]; forms: string[]; norm: string };
const COMPILED: Compiled[] = ROOTS.map((root) => ({
  root,
  words: fold(root.root, true).s.split(" "),
  forms: (root.forms ?? []).map((f) => fold(f, true).s),
  norm: fold(root.root, true).s,
}));

/** Number of roots in the built-in list (for docs/tests). */
export const LEXICON_SIZE = COMPILED.length;

type Token = { text: string; from: number; to: number };

function tokenize(f: Folded): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < f.s.length) {
    if (f.s[i] === " ") {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < f.s.length && f.s[j + 1] !== " ") j++;
    out.push({ text: f.s.slice(i, j + 1), from: f.start[i], to: f.end[j] });
    i = j + 1;
  }
  return out;
}

/** Returns a closeness score (lower is better) or -1 for no match. */
function matchToken(c: Compiled, idx: number, tok: Token, original: string): number {
  const rw = c.words[idx];
  const single = c.words.length === 1;
  const t = tok.text;
  if (rw.length === 1) {
    const next = original[tok.to];
    return t === rw && next !== "'" && next !== "’" ? 0 : -1;
  }
  if (!t.includes("*")) {
    if (t === rw) return 0;
    if (single && c.forms.includes(t)) return 0;
    if (single && c.root.prefix && rw.length >= 4 && t.startsWith(rw)) return 1;
    return -1;
  }
  // Wildcard token ("c***o", "d**", "f***ing"): a star run stands for one or more letters.
  if (!/^[a-z]/.test(t)) return -1;
  const re = new RegExp("^" + t.replace(/\*+/g, "[a-z]+") + "$");
  const cands = single ? [rw, ...c.forms] : [rw];
  let best = -1;
  for (const cand of cands) {
    if (!re.test(cand)) continue;
    const d = Math.abs(cand.length - t.length);
    if (best < 0 || d < best) best = d;
  }
  return best;
}

export function lexiconScan(text: string, rules: RuleSet): VerdictHit[] {
  const tokens = tokenize(fold(text, true));
  const free = new Set([...BUILTIN_FREE_WORDS, ...rules.free_terms].map((x) => fold(x, true).s));
  const hits: VerdictHit[] = [];
  let i = 0;
  while (i < tokens.length) {
    let best: { c: Compiled; score: number } | null = null;
    for (const c of COMPILED) {
      const n = c.words.length;
      if (i + n > tokens.length) continue;
      let score = 0;
      for (let k = 0; k < n && score >= 0; k++) {
        const m = matchToken(c, k, tokens[i + k], text);
        score = m < 0 ? -1 : score + m;
      }
      if (score < 0) continue;
      if (!best || n > best.c.words.length || (n === best.c.words.length && score < best.score)) best = { c, score };
    }
    if (!best) {
      i++;
      continue;
    }
    const n = best.c.words.length;
    const matched = tokens
      .slice(i, i + n)
      .map((t) => t.text)
      .join(" ");
    if (!free.has(best.c.norm) && !free.has(matched)) {
      hits.push({
        quote: text.slice(tokens[i].from, tokens[i + n - 1].to),
        normalized: best.c.root.root,
        tier_id: best.c.root.tier,
        is_mention: false,
        confidence: 0.8,
        reason: "Matched the built-in word list",
        ...(best.c.root.alt ? { alternative: best.c.root.alt } : {}),
      });
    }
    i += n;
  }
  return hits;
}
