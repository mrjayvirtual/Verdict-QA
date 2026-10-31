import type { Evaluation, Rubric } from './types';
import { effective } from './engine';

export const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'export';

export function download(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Quotes a CSV cell and neutralises spreadsheet formula injection. */
function cell(v: string | number | boolean | null | undefined): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const row = (vals: (string | number | boolean | null | undefined)[]): string => vals.map(cell).join(',');

export function rubricToCsv(r: Rubric): string {
  const head = row([
    'name', 'official_wording', 'description', 'weight', 'scale', 'required_evidence', 'required',
    'disqualifying', 'source_url', 'verification', 'parser_confidence', 'ambiguities',
  ]);
  const rows = r.criteria.map((c) =>
    row([
      c.name, c.officialWording, c.description, c.weight ?? 'Not specified', c.scale,
      c.requiredEvidence.join('; '), c.required, c.disqualifying, c.sourceUrl || 'Not specified',
      c.verification, c.confidence.toFixed(2), c.ambiguities,
    ]),
  );
  return [head, ...rows].join('\n');
}

export function rubricToMarkdown(r: Rubric): string {
  const lines = [
    `# ${r.name}`,
    '',
    `- Version: ${r.version}`,
    `- Source: ${r.sourceUrl || 'Not specified'} (${r.sourceStatus})`,
    `- Retrieved: ${r.fetchedAt ?? 'Not applicable'}`,
    `- Last updated: ${r.updatedAt}`,
    '',
    '| Criterion | Weight | Scale | Required | Verification |',
    '| --- | --- | --- | --- | --- |',
    ...r.criteria.map(
      (c) => `| ${c.name.replace(/\|/g, '/')} | ${c.weight ?? 'Not specified'} | ${c.scale} | ${c.required ? 'Yes' : 'No'} | ${c.verification} |`,
    ),
    '',
    '## Official wording',
    '',
    ...r.criteria.flatMap((c) => [`### ${c.name}`, '', `> ${c.officialWording}`, '', c.ambiguities ? `Ambiguities: ${c.ambiguities}` : '', '']),
  ];
  return lines.join('\n');
}

export function evaluationToCsv(ev: Evaluation): string {
  const head = row([
    'criterion', 'status', 'score', 'coverage_score', 'ai_score', 'confidence', 'evidence',
    'weaknesses', 'recommended_fix', 'human_override_reason',
  ]);
  const rows = ev.results.map((r) => {
    const e = effective(r);
    return row([
      r.name, e.status, e.score, r.coverageScore, r.aiScore, r.confidence.toFixed(2),
      r.evidence.map((x) => x.quote).join(' | '), r.weaknesses.join(' '), r.fix,
      r.humanOverride?.reason ?? '',
    ]);
  });
  return [head, ...rows].join('\n');
}

export function evaluationToMarkdown(ev: Evaluation, rubric: Rubric | undefined): string {
  const out: string[] = [
    `# Verdict QA report: ${ev.title}`,
    '',
    `**Verdict: ${ev.verdict}**`,
    '',
    `- Verdict internal score: ${ev.overallScore}/100 (${ev.weightedBasis === 'weighted' ? 'weighted by published weights' : 'equal weighting, because weights are not all published'})`,
    `- Official score: ${ev.officialScore || 'Not provided'} (entered by a person; Verdict does not compute official scores)`,
    `- Rubric: ${ev.rubricName} v${ev.rubricVersion}${rubric && rubric.version !== ev.rubricVersion ? ` (current version is v${rubric.version}; this report may be stale)` : ''}`,
    `- Submission type: ${ev.kind}`,
    `- Created: ${ev.createdAt}`,
    `- Human approved: ${ev.humanApproved ? 'Yes' : 'No'}`,
    '',
    '## Why this verdict',
    '',
    ...ev.verdictReasons.map((r) => `- ${r}`),
    '',
  ];

  if (ev.injectionFlags.length > 0) out.push('## Prompt-injection flags', '', ...ev.injectionFlags.map((f) => `- ${f}`), '');

  out.push('## Criteria', '');
  for (const r of ev.results) {
    const e = effective(r);
    out.push(`### ${r.name}`, '', `- Status: ${e.status}${r.humanOverride ? ' (human override)' : ''}`, `- Score: ${e.score ?? 'Manual check'}`);
    if (r.coverageScore !== null) out.push(`- Coverage score: ${r.coverageScore}`);
    if (r.aiScore !== null) out.push(`- AI consensus score: ${r.aiScore}`);
    out.push(`- Confidence: ${r.confidence.toFixed(2)}`, `- Explanation: ${r.explanation}`);
    if (r.evidence.length > 0) out.push('- Evidence:', ...r.evidence.map((x) => `  - "${x.quote}"`));
    if (r.weaknesses.length > 0) out.push('- Weaknesses:', ...r.weaknesses.map((w) => `  - ${w}`));
    if (r.fix) out.push(`- Recommended fix: ${r.fix}`);
    if (r.humanOverride) out.push(`- Human review: ${r.humanOverride.reason} (${r.humanOverride.at})`);
    out.push('');
  }

  out.push(
    '## Methodology',
    '',
    '- Deterministic checks match each criterion\'s key terms and required evidence against the submission and quote the passages found.',
    `- AI judges: ${ev.ai.status === 'not-requested' ? 'not used in this evaluation' : `${ev.ai.status} (${ev.ai.judges.map((j) => `${j.judge}: ${j.ok ? 'ok' : `failed${j.error ? ` - ${j.error}` : ''}`}`).join('; ')})`}.`,
    '- Scores from AI judges are blended 70/30 with deterministic coverage. A spread above 25 points between judges is flagged as disagreement.',
    '- Eligibility and disqualification rules are never auto-passed; they require human confirmation.',
    '',
    '## Limitations',
    '',
    '- Lexical coverage shows a criterion is addressed, not that it is addressed well.',
    '- The verdict internal score is not an official competition score and does not predict one.',
    '- Rubric accuracy depends on the text supplied. Verdict does not verify that a source is official.',
    '',
    '## Audit history',
    '',
    ...ev.audit.map((a) => `- ${a.at} | ${a.actor} | ${a.action} | ${a.detail}`),
    '',
  );
  return out.join('\n');
}
