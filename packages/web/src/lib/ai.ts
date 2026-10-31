import type { AiRun, Criterion, CriterionResult, Evidence, JudgeStatus } from './types';
import { statusFromScore } from './engine';
import { clip, normalizeWs } from './text';

export const TOKEN_KEY = 'verdict-qa:token';
export const JUDGES = ['strict', 'balanced', 'evidence-auditor'] as const;

interface JudgeCrit {
  id: string;
  score: number;
  rationale: string;
  quotes: string[];
}

export interface JudgeOk {
  judge: string;
  criteria: JudgeCrit[];
  usage: { input: number; output: number };
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function authHeaders(): Record<string, string> {
  return { 'content-type': 'application/json', 'x-verdict-token': getToken() };
}

/** Strictly validates an AI judge response. Anything malformed is rejected, never repaired silently. */
export function parseJudge(data: unknown, ids: Set<string>): JudgeOk {
  if (typeof data !== 'object' || data === null) throw new Error('Malformed judge response.');
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.criteria)) throw new Error('Judge response is missing the criteria list.');
  const out: JudgeCrit[] = [];
  for (const raw of d.criteria) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !ids.has(r.id)) continue;
    const score = typeof r.score === 'number' ? r.score : Number.NaN;
    if (!Number.isFinite(score) || score < 0 || score > 100) continue;
    out.push({
      id: r.id,
      score: Math.round(score),
      rationale: typeof r.rationale === 'string' ? r.rationale.slice(0, 600) : '',
      quotes: Array.isArray(r.quotes)
        ? r.quotes.filter((q): q is string => typeof q === 'string').slice(0, 3)
        : [],
    });
  }
  if (out.length === 0) throw new Error('Judge returned no valid criterion scores.');
  const u = (typeof d.usage === 'object' && d.usage !== null ? d.usage : {}) as Record<string, unknown>;
  return {
    judge: typeof d.judge === 'string' ? d.judge : '',
    criteria: out,
    usage: { input: Number(u.input) || 0, output: Number(u.output) || 0 },
  };
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return String((body as { error: unknown }).error);
  }
  return `HTTP ${status}`;
}

/**
 * Runs three independent judges. The run counts as successful only when at least
 * two of them return valid scores; otherwise it is reported as failed.
 */
export async function runJudges(
  submission: string,
  kind: string,
  criteria: Criterion[],
): Promise<{ run: AiRun; outs: JudgeOk[] }> {
  const scoring = criteria.filter((c) => !c.disqualifying);
  const ids = new Set(scoring.map((c) => c.id));
  const payload = scoring.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || c.officialWording,
    scale: c.scale,
    requiredEvidence: c.requiredEvidence,
  }));

  const settled = await Promise.allSettled(
    JUDGES.map(async (judge) => {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ judge, kind, submission, criteria: payload }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(body, res.status));
      return parseJudge(body, ids);
    }),
  );

  const judges: JudgeStatus[] = [];
  const outs: JudgeOk[] = [];
  settled.forEach((s, i) => {
    const name = JUDGES[i];
    if (s.status === 'fulfilled') {
      outs.push({ ...s.value, judge: name });
      judges.push({ judge: name, ok: true });
    } else {
      judges.push({ judge: name, ok: false, error: s.reason instanceof Error ? s.reason.message : String(s.reason) });
    }
  });

  const inputTokens = outs.reduce((a, o) => a + o.usage.input, 0);
  const outputTokens = outs.reduce((a, o) => a + o.usage.output, 0);
  if (outs.length < 2) {
    const firstError = judges.find((j) => !j.ok)?.error;
    return {
      run: {
        status: 'failed',
        judges,
        disagreements: [],
        inputTokens,
        outputTokens,
        error: firstError ?? 'Fewer than two judges returned valid scores.',
      },
      outs: [],
    };
  }
  return { run: { status: 'ok', judges, disagreements: [], inputTokens, outputTokens }, outs };
}

/** Blends judge consensus into the deterministic results and records disagreements. */
export function applyJudges(
  results: CriterionResult[],
  outs: JudgeOk[],
  submission: string,
): { results: CriterionResult[]; disagreements: { criterionId: string; spread: number }[] } {
  const norm = normalizeWs(submission);
  const disagreements: { criterionId: string; spread: number }[] = [];

  const next = results.map((r) => {
    if (r.isRule) return r;
    const scores: number[] = [];
    const notes: string[] = [];
    const quoted: Evidence[] = [];
    for (const o of outs) {
      const c = o.criteria.find((x) => x.id === r.criterionId);
      if (!c) continue;
      scores.push(c.score);
      if (c.rationale) notes.push(`${o.judge}: ${c.rationale}`);
      for (const q of c.quotes) {
        const nq = normalizeWs(q);
        if (nq.length >= 8 && norm.includes(nq)) {
          const start = submission.indexOf(q);
          quoted.push({ quote: clip(q, 240), start, end: start >= 0 ? start + q.length : -1, matchedTerms: ['ai-cited'] });
        } else {
          notes.push(`A quote from ${o.judge} was dropped because it does not appear in the submission.`);
        }
      }
    }
    if (scores.length < 2) return r;

    scores.sort((a, b) => a - b);
    const mid = scores.length / 2;
    const median = scores.length % 2 === 1 ? scores[(scores.length - 1) / 2] : Math.round((scores[mid - 1] + scores[mid]) / 2);
    const spread = scores[scores.length - 1] - scores[0];
    const score = Math.round(0.7 * median + 0.3 * (r.coverageScore ?? 0));
    const disputed = spread > 25;
    if (disputed) disagreements.push({ criterionId: r.criterionId, spread });

    return {
      ...r,
      aiScore: median,
      score,
      status: disputed ? ('needs-review' as const) : statusFromScore(score),
      aiNotes: notes,
      evidence: [...r.evidence, ...quoted].slice(0, 5),
      confidence: disputed ? 0.4 : Math.min(0.9, 0.6 + (100 - spread) / 300),
    };
  });

  return { results: next, disagreements };
}
