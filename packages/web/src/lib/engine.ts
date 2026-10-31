import type {
  AiRun,
  Criterion,
  CriterionResult,
  CriterionStatus,
  Evaluation,
  Evidence,
  Rubric,
  Settings,
  SubmissionKind,
  Verdict,
} from './types';
import { clip, extractKeywords, hasTerm, nowIso, sentences, uid, type Sentence } from './text';

export const emptyAi = (): AiRun => ({
  status: 'not-requested',
  judges: [],
  disagreements: [],
  inputTokens: 0,
  outputTokens: 0,
});

export function statusFromScore(score: number): CriterionStatus {
  if (score >= 70) return 'pass';
  if (score >= 35) return 'partial';
  return 'fail';
}

/** The status and score that count after any human override. */
export function effective(r: CriterionResult): { status: CriterionStatus; score: number | null } {
  if (r.humanOverride) return { status: r.humanOverride.status, score: r.humanOverride.score };
  return { status: r.status, score: r.score };
}

export function evaluateCriterion(c: Criterion, submission: string, sents: Sentence[]): CriterionResult {
  const base: CriterionResult = {
    criterionId: c.id,
    name: c.name,
    isRule: c.disqualifying,
    required: c.required,
    status: 'needs-review',
    coverageScore: null,
    aiScore: null,
    score: null,
    evidence: [],
    weaknesses: [],
    explanation: '',
    confidence: 0,
    fix: '',
    aiNotes: [],
  };

  if (c.disqualifying) {
    return {
      ...base,
      weaknesses: ['Compliance cannot be verified automatically.'],
      explanation:
        'This is an eligibility or disqualification rule. A text match cannot confirm compliance, so a person must confirm it.',
      fix: `Confirm manually that the submission complies with: ${clip(c.officialWording, 240)}`,
    };
  }

  const terms = c.keywords.length > 0 ? c.keywords : extractKeywords(`${c.name} ${c.description}`, 8);
  const matched = terms.filter((t) => hasTerm(submission, t));
  const missing = terms.filter((t) => !matched.includes(t));
  const coverage = terms.length > 0 ? matched.length / terms.length : 0;

  const evidence: Evidence[] = sents
    .map((x) => ({ x, hits: terms.filter((t) => hasTerm(x.s, t)) }))
    .filter((y) => y.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length)
    .slice(0, 3)
    .map(({ x, hits }) => ({
      quote: clip(x.s, 240),
      start: x.start,
      end: x.start + x.s.length,
      matchedTerms: hits,
    }));

  let evidenceCoverage: number | null = null;
  const missingEvidence: string[] = [];
  if (c.requiredEvidence.length > 0) {
    let met = 0;
    for (const e of c.requiredEvidence) {
      const ts = extractKeywords(e, 4);
      const ok = ts.length > 0 && ts.filter((t) => hasTerm(submission, t)).length >= Math.ceil(ts.length / 2);
      if (ok) met += 1;
      else missingEvidence.push(e);
    }
    evidenceCoverage = met / c.requiredEvidence.length;
  }

  const blended = evidenceCoverage === null ? coverage : 0.6 * coverage + 0.4 * evidenceCoverage;
  const depth = evidence.length >= 2 ? 1 : 0.85;
  const coverageScore = Math.round(100 * blended * depth);
  const thin = terms.length < 2;
  const status: CriterionStatus = thin ? 'needs-review' : statusFromScore(coverageScore);

  const weaknesses: string[] = [];
  if (thin) weaknesses.push('Too few distinctive terms in this criterion to match reliably.');
  if (evidence.length === 0) weaknesses.push('No passage in the submission addresses this criterion.');
  if (missing.length > 0) weaknesses.push(`Key terms not found: ${missing.join(', ')}.`);
  for (const e of missingEvidence) weaknesses.push(`Required evidence not found: ${e}.`);

  const fixParts: string[] = [];
  if (status !== 'pass') {
    fixParts.push(`Address "${c.name}" explicitly with substantiated content.`);
    if (missing.length > 0) fixParts.push(`Cover: ${missing.join(', ')}.`);
    if (missingEvidence.length > 0) fixParts.push(`Provide evidence of: ${missingEvidence.join('; ')}.`);
  }

  return {
    ...base,
    status,
    coverageScore,
    score: coverageScore,
    evidence,
    weaknesses,
    explanation: `Matched ${matched.length} of ${terms.length} key terms (${matched.join(', ') || 'none'}). This is lexical coverage: it shows the submission discusses the topic, not that it does so well.`,
    confidence: thin ? 0.3 : Math.min(0.7, 0.35 + 0.35 * coverage),
    fix: fixParts.join(' '),
  };
}

export function runDeterministic(submission: string, rubric: Rubric): CriterionResult[] {
  const sents = sentences(submission);
  return rubric.criteria.map((c) => evaluateCriterion(c, submission, sents));
}

/**
 * Recomputes the overall score and verdict from the current results.
 * Called after creation, AI scoring, human overrides and approvals so the verdict
 * always reflects the latest evidence.
 */
export function finalize(ev: Evaluation, rubric: Rubric | undefined, s: Settings): Evaluation {
  const weightOf = (id: string): number | null => rubric?.criteria.find((c) => c.id === id)?.weight ?? null;
  const scoring = ev.results.filter((r) => !r.isRule);
  const weighted =
    scoring.length > 0 &&
    scoring.every((r) => {
      const w = weightOf(r.criterionId);
      return w !== null && w > 0;
    });

  let num = 0;
  let den = 0;
  for (const r of scoring) {
    const e = effective(r);
    const w = weighted ? (weightOf(r.criterionId) as number) : 1;
    num += w * (e.score ?? 0);
    den += w;
  }
  const overall = den > 0 ? Math.round(num / den) : 0;

  const reasons: string[] = [];
  const disq = ev.results.filter((r) => r.isRule && effective(r).status === 'fail').map((r) => r.name);
  const unresolvedRules = ev.results.filter((r) => r.isRule && effective(r).status === 'needs-review');
  const reqFail = scoring.filter((r) => r.required && effective(r).status === 'fail');
  const reqPartial = scoring.filter((r) => r.required && effective(r).status === 'partial');
  const review = scoring.filter((r) => effective(r).status === 'needs-review');

  let verdict: Verdict;
  if (disq.length > 0) {
    verdict = 'FAIL';
    reasons.push(`Disqualifying rule violated: ${disq.join('; ')}.`);
  } else if (reqFail.length > 0) {
    verdict = 'FAIL';
    reasons.push(`Required criteria failed: ${reqFail.map((r) => r.name).join('; ')}.`);
  } else if (overall < s.failThreshold) {
    verdict = 'FAIL';
    reasons.push(`Internal score ${overall} is below the fail threshold of ${s.failThreshold}.`);
  } else if (ev.ai.status === 'failed') {
    verdict = 'NEEDS REVIEW';
    reasons.push(`AI assessment was requested but did not complete${ev.ai.error ? `: ${ev.ai.error}` : '.'} The result is not treated as a successful evaluation.`);
  } else if (ev.ai.disagreements.length > 0) {
    verdict = 'NEEDS REVIEW';
    reasons.push(`AI judges disagreed on ${ev.ai.disagreements.length} criteria. A person must resolve them.`);
  } else if (ev.injectionFlags.length > 0) {
    verdict = 'NEEDS REVIEW';
    reasons.push('The submission contains text that tries to instruct the evaluator. Review it before trusting the score.');
  } else if (unresolvedRules.length > 0) {
    verdict = 'NEEDS REVIEW';
    reasons.push(`${unresolvedRules.length} eligibility or disqualification rule(s) need manual confirmation.`);
  } else if (review.length > 0) {
    verdict = 'NEEDS REVIEW';
    reasons.push(`${review.length} criteria could not be assessed with confidence.`);
  } else if (overall >= s.passThreshold && reqPartial.length === 0) {
    if (ev.ai.status === 'ok' || ev.humanApproved) {
      verdict = 'PASS';
      reasons.push(`Internal score ${overall} meets the pass threshold of ${s.passThreshold}.`);
    } else {
      verdict = 'CONDITIONAL PASS';
      reasons.push('Score meets the pass threshold on lexical coverage only. Quality was not assessed. Run the AI judges or record a human approval to confirm.');
    }
  } else if (overall >= s.conditionalThreshold) {
    verdict = 'CONDITIONAL PASS';
    reasons.push(`Internal score ${overall} is between ${s.conditionalThreshold} and ${s.passThreshold}${reqPartial.length > 0 ? ', or a required criterion is only partly met' : ''}.`);
  } else {
    verdict = 'NEEDS REVIEW';
    reasons.push(`Internal score ${overall} is between the fail threshold (${s.failThreshold}) and the conditional threshold (${s.conditionalThreshold}).`);
  }

  return {
    ...ev,
    overallScore: overall,
    weightedBasis: weighted ? 'weighted' : 'equal',
    verdict,
    verdictReasons: reasons,
    disqualifiers: disq,
  };
}

export interface BuildInput {
  projectId: string | null;
  rubric: Rubric;
  kind: SubmissionKind;
  title: string;
  submission: string;
  parentId: string | null;
  officialScore: string;
  results: CriterionResult[];
  ai: AiRun;
  injectionFlags: string[];
}

export function buildEvaluation(i: BuildInput, settings: Settings): Evaluation {
  const at = nowIso();
  const ev: Evaluation = {
    id: uid(),
    projectId: i.projectId,
    rubricId: i.rubric.id,
    rubricVersion: i.rubric.version,
    rubricName: i.rubric.name,
    kind: i.kind,
    title: i.title,
    submission: i.submission,
    createdAt: at,
    parentId: i.parentId,
    results: i.results,
    overallScore: 0,
    weightedBasis: 'equal',
    verdict: 'NEEDS REVIEW',
    verdictReasons: [],
    disqualifiers: [],
    injectionFlags: i.injectionFlags,
    ai: i.ai,
    humanApproved: false,
    officialScore: i.officialScore,
    audit: [
      {
        at,
        actor: 'system',
        action: 'evaluation-created',
        detail: `Rubric "${i.rubric.name}" v${i.rubric.version}. Deterministic checks${i.ai.status === 'not-requested' ? ' only.' : ` plus AI judges (${i.ai.status}).`}`,
      },
    ],
  };
  return finalize(ev, i.rubric, settings);
}
