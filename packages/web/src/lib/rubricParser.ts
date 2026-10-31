import type { Criterion, Verification } from './types';
import { clip, extractKeywords, uid } from './text';

const WEIGHT_RE = /\(?\b(\d+(?:\.\d+)?)\s*(%|percent\b|points?\b|pts?\b)\)?/i;
const RULE_RE = /(disqualif|ineligible|not eligible|will be rejected|must not|may not be|prohibited|not permitted)/i;
const REQUIRED_RE = /\b(must|required|mandatory|eligib)/i;
const ITEM_RE = /^\s*(?:\d+[.)]|[-*\u2022\u2013]|\([a-z0-9]\))\s+(.+)$/;
const EVID_RE =
  /(?:must (?:include|provide|demonstrate|show)|should (?:include|provide|demonstrate|show)|evidence of|provide|include|demonstrate)\s+([^.;]{4,120})/i;
const SPLIT_RE = /^(.{3,60}?)\s*(?:[:\u2013\u2014]|\s-\s)\s*(.+)$/;

export interface ParseResult {
  criteria: Criterion[];
  notes: string[];
}

function toCriterion(raw: string, sourceUrl: string, verification: Verification): Criterion {
  const wm = WEIGHT_RE.exec(raw);
  let weight: number | null = null;
  let scale = 'Not specified';
  if (wm) {
    weight = Number(wm[1]);
    const unit = wm[2].toLowerCase();
    scale = unit === '%' || unit === 'percent' ? 'Weight in percent' : `0\u2013${weight} points`;
  }
  const cleaned = raw
    .replace(WEIGHT_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s:\-\u2013\u2014]+$/, '')
    .trim();
  const split = SPLIT_RE.exec(cleaned);
  const name = split ? split[1].trim() : clip(cleaned.split(/\s+/).slice(0, 6).join(' '), 60);
  let description = split ? split[2].trim() : cleaned;
  if (description === name) description = '';

  const disqualifying = RULE_RE.test(raw);
  const required = disqualifying || REQUIRED_RE.test(raw);
  const em = disqualifying ? null : EVID_RE.exec(description || cleaned);
  const requiredEvidence = em
    ? em[1]
        .split(/,|\band\b|;/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 4)
        .slice(0, 4)
    : [];

  const ambiguities: string[] = [];
  if (weight === null && !disqualifying) ambiguities.push('Weight not published in the supplied text.');
  if (!description && !disqualifying) ambiguities.push('No description beyond the title.');
  if (!split) ambiguities.push('Name and description could not be separated reliably.');

  let confidence = 0.5;
  if (weight !== null) confidence += 0.2;
  if (split) confidence += 0.15;
  if (description.length > 20) confidence += 0.1;

  return {
    id: uid(),
    name: name || 'Untitled criterion',
    officialWording: raw.trim(),
    description,
    weight: disqualifying ? null : weight,
    scale: disqualifying ? 'Pass / fail rule' : scale,
    requiredEvidence,
    required,
    disqualifying,
    keywords: extractKeywords(`${name} ${description}`, 8),
    sourceUrl,
    verification,
    confidence: disqualifying ? 0.6 : Math.min(0.9, confidence),
    ambiguities: ambiguities.join(' '),
  };
}

/**
 * Deterministic extraction of criteria, weights and rules from pasted or fetched text.
 * It never invents anything: weights that are not present stay null ("Not specified").
 */
export function parseRubricText(text: string, sourceUrl: string, verification: Verification): ParseResult {
  const candidates: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length < 8) continue;
    const item = ITEM_RE.exec(line);
    if (!item && !WEIGHT_RE.test(t) && !RULE_RE.test(t)) continue;
    candidates.push((item ? item[1] : t).trim());
  }

  const seen = new Set<string>();
  const criteria: Criterion[] = [];
  for (const raw of candidates) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    criteria.push(toCriterion(raw, sourceUrl, verification));
  }

  const notes: string[] = [];
  const scoring = criteria.filter((c) => !c.disqualifying);
  const weighted = scoring.filter((c) => c.weight !== null);
  if (criteria.length === 0) {
    notes.push('No criteria, weights or rules were detected in this text.');
  } else if (scoring.length > 0 && weighted.length === 0) {
    notes.push('No weights were found. Weights are shown as "Not specified" and scoring is equal-weighted.');
  } else if (weighted.length < scoring.length) {
    notes.push(`${scoring.length - weighted.length} criteria have no published weight, so scoring is equal-weighted until every weight is set.`);
  }
  const pct = scoring.filter((c) => c.scale === 'Weight in percent');
  if (pct.length > 0) {
    const sum = pct.reduce((a, c) => a + (c.weight ?? 0), 0);
    if (Math.abs(sum - 100) > 1) notes.push(`Percent weights add up to ${sum}, not 100. Check the source for missing or unparsed criteria.`);
  }
  return { criteria, notes };
}
