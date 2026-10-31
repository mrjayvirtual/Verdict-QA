import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Badge, Card, CopyButton, Empty, Notice, PageHeader, ScoreBar, StatusBadge, VerdictBadge, fmtDate } from '../components/ui';
import { effective, finalize } from '../lib/engine';
import { buildRepairPrompt, compareEvaluations, syncIssues, type Comparison } from '../lib/remediation';
import { download, evaluationToCsv, evaluationToMarkdown, slug } from '../lib/exporters';
import { nowIso } from '../lib/text';
import type { CriterionResult, CriterionStatus, Evaluation } from '../lib/types';

function CriterionCard({
  r,
  onOverride,
  onClear,
}: {
  r: CriterionResult;
  onOverride: (status: CriterionStatus, score: number | null, reason: string) => void;
  onClear: () => void;
}) {
  const e = effective(r);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CriterionStatus>(e.status === 'needs-review' ? 'pass' : e.status);
  const [score, setScore] = useState<string>(e.score === null ? '' : String(e.score));
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (reason.trim().length < 5) {
      setErr('Explain the change in a sentence. It is stored in the audit history.');
      return;
    }
    let sc: number | null = null;
    if (!r.isRule) {
      const n = Number(score);
      if (score.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100) {
        setErr('Score must be a number from 0 to 100.');
        return;
      }
      sc = Math.round(n);
    }
    onOverride(status, sc, reason.trim());
    setOpen(false);
    setReason('');
    setErr(null);
  }

  return (
    <div className="criterion">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <strong>{r.name}</strong>
          <StatusBadge s={e.status} />
          {r.isRule ? <Badge tone="bad">Rule</Badge> : r.required ? <Badge tone="gold">Required</Badge> : null}
          {r.humanOverride ? <Badge tone="violet">Human override</Badge> : null}
        </div>
        <div style={{ minWidth: 140 }}><ScoreBar value={e.score} /></div>
      </div>

      <p className="muted">{r.explanation}</p>
      <div className="row muted">
        {r.coverageScore !== null ? <span>Coverage {r.coverageScore}</span> : null}
        {r.aiScore !== null ? <span>AI consensus {r.aiScore}</span> : null}
        <span>Confidence {Math.round(r.confidence * 100)}%</span>
      </div>

      {r.evidence.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <h3>Evidence</h3>
          {r.evidence.map((x, i) => (
            <div key={`${x.start}-${i}`} className="quote">
              {x.quote}
              <div className="muted">{x.start >= 0 ? `characters ${x.start}-${x.end}` : 'location unknown'} | {x.matchedTerms.join(', ')}</div>
            </div>
          ))}
        </div>
      ) : null}

      {r.weaknesses.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <h3>Weaknesses</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{r.weaknesses.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      ) : null}
      {r.fix ? <p style={{ marginTop: 8 }}><strong>Recommended fix:</strong> {r.fix}</p> : null}
      {r.aiNotes.length > 0 ? (
        <details style={{ marginTop: 8 }}>
          <summary>AI judge notes</summary>
          <ul>{r.aiNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </details>
      ) : null}
      {r.humanOverride ? <Notice tone="blue">Human review ({fmtDate(r.humanOverride.at)}): {r.humanOverride.reason}</Notice> : null}

      <div className="row no-print" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel review' : 'Human review'}</button>
        {r.humanOverride ? <button type="button" className="btn btn-sm" onClick={onClear}>Clear override</button> : null}
      </div>
      {open ? (
        <div className="grid grid-3 no-print" style={{ marginTop: 10 }}>
          <label>Status
            <select value={status} onChange={(ev) => setStatus(ev.target.value as CriterionStatus)}>
              <option value="pass">pass</option>
              {r.isRule ? null : <option value="partial">partial</option>}
              <option value="fail">fail</option>
            </select>
          </label>
          {r.isRule ? <span /> : <label>Score (0 to 100)<input type="number" min="0" max="100" value={score} onChange={(ev) => setScore(ev.target.value)} /></label>}
          <label>Reason (required)<input value={reason} onChange={(ev) => setReason(ev.target.value)} /></label>
          <div className="row">
            <button type="button" className="btn btn-primary btn-sm" onClick={submit}>Save review</button>
            {err ? <Badge tone="bad">{err}</Badge> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComparisonView({ title, cmp }: { title: string; cmp: Comparison }) {
  return (
    <Card title={title}>
      <div className="row" style={{ marginBottom: 10 }}>
        <Badge tone={cmp.gate === 'CLEARED' ? 'good' : 'bad'}>Regression gate: {cmp.gate}</Badge>
        <Badge tone="good">{cmp.resolved} resolved</Badge>
        <Badge tone="warn">{cmp.remaining} remaining</Badge>
        <Badge tone={cmp.regressions > 0 ? 'bad' : 'neutral'}>{cmp.regressions} regressions</Badge>
        <span className="muted">Overall {cmp.overallBefore} to {cmp.overallAfter}</span>
      </div>
      {cmp.gateReasons.length > 0 ? <Notice tone="warn">{cmp.gateReasons.join(' ')}</Notice> : null}
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Criterion</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
          <tbody>
            {cmp.deltas.map((d) => (
              <tr key={d.criterionId}>
                <td>{d.name}</td>
                <td>{d.before ?? '-'} <span className="muted">{d.statusBefore}</span></td>
                <td>{d.after ?? '-'} <span className="muted">{d.statusAfter}</span></td>
                <td><Badge tone={d.change === 'resolved' || d.change === 'improved' ? 'good' : d.change === 'regressed' ? 'bad' : 'neutral'}>{d.change}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function EvaluationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state, update } = useStore();
  const [officialDraft, setOfficialDraft] = useState<string | null>(null);
  const [approveReason, setApproveReason] = useState('');
  const [approveErr, setApproveErr] = useState<string | null>(null);

  const ev = state.evaluations.find((e) => e.id === id);
  if (!ev) {
    return <Empty title="Evaluation not found" hint="It may have been deleted."><Link to="/evaluations">Back to evaluations</Link></Empty>;
  }

  const rubric = state.rubrics.find((r) => r.id === ev.rubricId);
  const project = state.projects.find((p) => p.id === ev.projectId);
  const parent = state.evaluations.find((e) => e.id === ev.parentId);
  const baseline = project ? state.evaluations.find((e) => e.id === project.baselineEvaluationId) : undefined;
  const tol = state.settings.regressionTolerance;

  function patch(fn: (e: Evaluation) => Evaluation) {
    update((s) => {
      const cur = s.evaluations.find((e) => e.id === id);
      if (!cur) return s;
      const rub = s.rubrics.find((r) => r.id === cur.rubricId);
      const next = finalize(fn(cur), rub, s.settings);
      return { ...s, evaluations: s.evaluations.map((e) => (e.id === next.id ? next : e)), issues: syncIssues(s.issues, next) };
    });
  }

  function override(criterionId: string, status: CriterionStatus, score: number | null, reason: string) {
    patch((cur) => {
      const at = nowIso();
      const old = cur.results.find((r) => r.criterionId === criterionId);
      const before = old ? effective(old) : null;
      return {
        ...cur,
        results: cur.results.map((r) => (r.criterionId === criterionId ? { ...r, humanOverride: { status, score, reason, at } } : r)),
        audit: [...cur.audit, { at, actor: 'human', action: 'criterion-override', detail: `${old?.name ?? criterionId}: ${before?.status ?? '?'} ${before?.score ?? '-'} to ${status} ${score ?? '-'}. Reason: ${reason}` }],
      };
    });
  }

  function clearOverride(criterionId: string) {
    patch((cur) => ({
      ...cur,
      results: cur.results.map((r) => {
        if (r.criterionId !== criterionId) return r;
        const { humanOverride: _removed, ...rest } = r;
        return rest;
      }),
      audit: [...cur.audit, { at: nowIso(), actor: 'human', action: 'override-cleared', detail: cur.results.find((r) => r.criterionId === criterionId)?.name ?? criterionId }],
    }));
  }

  function approve() {
    if (approveReason.trim().length < 5) {
      setApproveErr('Say what you reviewed. It is stored in the audit history.');
      return;
    }
    setApproveErr(null);
    patch((cur) => ({ ...cur, humanApproved: true, audit: [...cur.audit, { at: nowIso(), actor: 'human', action: 'approved', detail: approveReason.trim() }] }));
    setApproveReason('');
  }

  function revoke() {
    patch((cur) => ({ ...cur, humanApproved: false, audit: [...cur.audit, { at: nowIso(), actor: 'human', action: 'approval-revoked', detail: 'Approval removed.' }] }));
  }

  function saveOfficial() {
    if (officialDraft === null || officialDraft === ev.officialScore) return;
    const value = officialDraft.trim();
    patch((cur) => ({ ...cur, officialScore: value, audit: [...cur.audit, { at: nowIso(), actor: 'human', action: 'official-score-recorded', detail: value || 'Cleared' }] }));
    setOfficialDraft(null);
  }

  function setBaseline() {
    if (!project) return;
    update((s) => ({ ...s, projects: s.projects.map((p) => (p.id === project.id ? { ...p, baselineEvaluationId: ev.id } : p)) }));
  }

  function remove() {
    if (!window.confirm('Delete this evaluation?')) return;
    update((s) => ({ ...s, evaluations: s.evaluations.filter((e) => e.id !== ev.id), projects: s.projects.map((p) => (p.baselineEvaluationId === ev.id ? { ...p, baselineEvaluationId: null } : p)) }));
    nav('/evaluations');
  }

  const prompt = buildRepairPrompt(ev, rubric);
  const staleRubric = rubric && rubric.version !== ev.rubricVersion;
  const tests = state.testCases.filter((t) => ev.projectId !== null && t.projectId === ev.projectId);
  const testPass = tests.filter((t) => t.runs[t.runs.length - 1]?.result === 'pass').length;
  const testFail = tests.filter((t) => t.runs[t.runs.length - 1]?.result === 'fail').length;

  return (
    <>
      <PageHeader
        title={ev.title}
        sub={`${ev.rubricName} v${ev.rubricVersion} | ${ev.kind} | ${fmtDate(ev.createdAt)}${project ? ` | ${project.name}` : ''}`}
        actions={
          <>
            <Link className="btn" to={`/evaluate?from=${ev.id}`}>Re-evaluate</Link>
            <button type="button" className="btn" onClick={() => download(`${slug(ev.title)}-report.md`, evaluationToMarkdown(ev, rubric), 'text/markdown')}>Report (.md)</button>
            <button type="button" className="btn" onClick={() => download(`${slug(ev.title)}.csv`, evaluationToCsv(ev), 'text/csv')}>CSV</button>
            <button type="button" className="btn" onClick={() => download(`${slug(ev.title)}.json`, JSON.stringify(ev, null, 2), 'application/json')}>JSON</button>
            <button type="button" className="btn" onClick={() => window.print()}>Print</button>
            {project ? <button type="button" className="btn" disabled={project.baselineEvaluationId === ev.id} onClick={setBaseline}>{project.baselineEvaluationId === ev.id ? 'Is baseline' : 'Set as baseline'}</button> : null}
            <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>
          </>
        }
      />

      {staleRubric ? <Notice tone="warn">This evaluation used rubric v{ev.rubricVersion}. The rubric is now v{rubric?.version}. Re-evaluate to see the impact of the change.</Notice> : null}

      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <div className="stat"><span>Verdict</span><div style={{ marginTop: 6 }}><VerdictBadge v={ev.verdict} /></div></div>
        <div className="stat gold"><b>{ev.overallScore}</b><span>Verdict internal score ({ev.weightedBasis === 'weighted' ? 'weighted' : 'equal weighting'}). Not an official score.</span></div>
        <div className="stat">
          <span>Official score (entered by a person)</span>
          <input style={{ marginTop: 6 }} value={officialDraft ?? ev.officialScore} onChange={(e) => setOfficialDraft(e.target.value)} onBlur={saveOfficial} placeholder="Not provided" />
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <Card title="Why this verdict">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{ev.verdictReasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {ev.weightedBasis === 'equal' ? <p className="muted">Equal weighting is used because not every scored criterion has a published weight.</p> : null}
          {ev.injectionFlags.length > 0 ? <div style={{ marginTop: 10 }}><Notice tone="bad">Prompt-injection tripwire: {ev.injectionFlags.join('; ')}</Notice></div> : null}
        </Card>

        <Card title="AI assessment">
          {ev.ai.status === 'not-requested' ? (
            <p className="muted">Not requested for this evaluation. Scores come from deterministic coverage checks only.</p>
          ) : (
            <div className="stack">
              <div className="row">
                <Badge tone={ev.ai.status === 'ok' ? 'good' : 'bad'}>{ev.ai.status === 'ok' ? 'Completed' : 'Failed'}</Badge>
                {ev.ai.judges.map((j) => <Badge key={j.judge} tone={j.ok ? 'good' : 'bad'}>{j.judge}: {j.ok ? 'ok' : 'failed'}</Badge>)}
                <span className="muted">{ev.ai.inputTokens.toLocaleString()} input and {ev.ai.outputTokens.toLocaleString()} output tokens</span>
              </div>
              {ev.ai.error ? <Notice tone="bad">{ev.ai.error}</Notice> : null}
              {ev.ai.judges.filter((j) => !j.ok && j.error).map((j) => <p key={j.judge} className="muted">{j.judge}: {j.error}</p>)}
              {ev.ai.disagreements.length > 0 ? <Notice tone="warn">Judges disagreed by more than 25 points on: {ev.ai.disagreements.map((d) => `${ev.results.find((r) => r.criterionId === d.criterionId)?.name ?? d.criterionId} (${d.spread})`).join(', ')}. Use human review to settle them.</Notice> : null}
            </div>
          )}
        </Card>

        <h2>Criteria</h2>
        {ev.results.map((r) => (
          <CriterionCard key={r.criterionId} r={r} onOverride={(st, sc, reason) => override(r.criterionId, st, sc, reason)} onClear={() => clearOverride(r.criterionId)} />
        ))}

        <Card title="Human approval">
          {ev.humanApproved ? (
            <div className="row"><Badge tone="good">Approved by a person</Badge><button type="button" className="btn btn-sm no-print" onClick={revoke}>Revoke approval</button></div>
          ) : (
            <div className="row no-print">
              <input style={{ maxWidth: 420 }} placeholder="What did you review before approving?" value={approveReason} onChange={(e) => setApproveReason(e.target.value)} />
              <button type="button" className="btn btn-sm" onClick={approve}>Approve as reviewed</button>
              {approveErr ? <Badge tone="bad">{approveErr}</Badge> : null}
            </div>
          )}
          <p className="muted">A PASS verdict needs either completed AI judges or a recorded human approval, in addition to a score above the pass threshold.</p>
        </Card>

        {parent ? <ComparisonView title={`Re-evaluation vs. "${parent.title}"`} cmp={compareEvaluations(parent, ev, tol)} /> : null}
        {baseline && baseline.id !== ev.id && baseline.id !== parent?.id ? <ComparisonView title={`Quality regression gate vs. baseline "${baseline.title}"`} cmp={compareEvaluations(baseline, ev, tol)} /> : null}

        <Card title="Evidence graph">
          <details open>
            <summary><VerdictBadge v={ev.verdict} /> {ev.title} ({ev.overallScore})</summary>
            {ev.results.map((r) => {
              const e = effective(r);
              const issue = state.issues.find((i) => i.rubricId === ev.rubricId && i.criterionId === r.criterionId && (i.evaluationId === ev.id || i.resolvedByEvaluationId === ev.id));
              const crit = rubric?.criteria.find((c) => c.id === r.criterionId);
              return (
                <details key={r.criterionId}>
                  <summary>{r.name} <StatusBadge s={e.status} /></summary>
                  <div className="stack" style={{ marginTop: 6 }}>
                    <div><strong>Criterion:</strong> {crit?.officialWording || 'Rubric entry no longer available'}{crit?.sourceUrl ? <> ({crit.sourceUrl})</> : null}</div>
                    <div><strong>Evidence:</strong> {r.evidence.length === 0 ? 'None found' : r.evidence.map((x) => `"${x.quote}"`).join(' | ')}</div>
                    <div><strong>Tests:</strong> {ev.projectId ? `${testPass} passing, ${testFail} failing, ${tests.length - testPass - testFail} not passed or not run (project level)` : 'No project, so no linked tests'}</div>
                    <div><strong>Recommended fix:</strong> {r.fix || 'None needed'}</div>
                    <div><strong>Issue:</strong> {issue ? <Link to="/issues">{issue.title} ({issue.status})</Link> : 'None'}</div>
                  </div>
                </details>
              );
            })}
          </details>
        </Card>

        <Card title="Agent repair prompt" actions={<CopyButton text={prompt} label="Copy prompt" />}>
          <p className="muted">Give this to your coding or writing agent, apply the fix yourself, then use Re-evaluate to verify. Verdict does not claim a fix worked until the re-evaluation shows it.</p>
          <div className="prompt">{prompt}</div>
        </Card>

        <Card title="Audit history">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {ev.audit.map((a, i) => <li key={i}><span className="muted">{fmtDate(a.at)}</span> | {a.actor} | {a.action} | {a.detail}</li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
