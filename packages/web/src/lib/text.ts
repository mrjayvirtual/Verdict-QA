export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const nowIso = (): string => new Date().toISOString();

export const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const normalizeWs = (s: string): string => s.replace(/\s+/g, ' ').trim();

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STOP = new Set(
  'the and for with that this from will have must should your their which into over than then also such each are was were been being about above after project projects submission submissions criteria criterion score scores points point evaluate evaluated judges judge team teams they them these those other more most some very well can may not all any one two use used using make made'.split(
    ' ',
  ),
);

/** Significant lowercase terms (length >= 4) used for lexical matching. */
export function extractKeywords(text: string, max = 8): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

/** Very light suffix stripping so "documented" matches "documentation". */
export function stem(w: string): string {
  return w.length > 5 ? w.replace(/(ations?|ation|ings?|ing|ed|es|ly|s)$/, '') : w;
}

const termCache = new Map<string, RegExp>();

export function hasTerm(text: string, term: string): boolean {
  let re = termCache.get(term);
  if (!re) {
    re = new RegExp(`\\b${escapeRegExp(stem(term))}`, 'i');
    termCache.set(term, re);
  }
  return re.test(text);
}

export interface Sentence {
  s: string;
  start: number;
}

/** Splits text into sentences/lines and keeps the character offset of each. */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+[.!?]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const s = raw.trim();
    if (s.length >= 12) out.push({ s, start: m.index + (raw.length - raw.trimStart().length) });
  }
  return out;
}
