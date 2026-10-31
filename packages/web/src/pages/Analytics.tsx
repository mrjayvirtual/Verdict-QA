import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Card, Empty, PageHeader, VerdictBadge } from '../components/ui';
import { effective } from '../lib/engine';
import type { Verdict } from '../lib/types';

const VERDICTS: Verdict[] = ['PASS', 'CONDITIONAL PASS', 'NEEDS REVIEW', 'FAIL'];
const W = 640;
const H = 200;
const PAD = 28;

function Trend({ scores }: { scores: number[] }) {
  const n = scores.length;
  const pts = scores.map((s, i) => ({
    x: n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1),
    y: H - PAD - (s / 100) * (H - 2 * PAD),
    s,
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Internal score over time">
      {[0, 50, 100].map((g) => {
        const y = H - PAD - (g / 100) * (H - 2 * PAD);
        return (
          <g key={g}>
            <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#242a3d" />
            <text x={4} y={y + 4} fill="#8b93ab" fontSize="10">{g}</text>
          </g>
        );
      })}
      {n > 1 ? <polyline fill="none" stroke="#5b8dff" strokeWidth="2" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} /> : null}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#e3b45a" />
          <text x={p.x} y={p.y - 8} fill="#e7e9f2" fontSize="10" textAnchor="middle">{p.s}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Analytics() {
  const { state } = useStore();
  const [projectId, setProjectId] = useState('all');

  const data = useMemo(() => {
    const evals = state.evaluations
      .filter((e) => projectId === 'all' || (projectId === 'none' ? e.projectId === null : e.projectId === projectId))
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const unmet = new Map<string, number>();
    let criteriaTotal = 0;
    let criteriaPass = 0;
    for (const e of evals) {
      for (const r of e.results) {
        if (r.isRule) continue;
        criteriaTotal += 1;
        const st = effective(r).status;
        if (st === 'pass') criteriaPass += 1;
        if (st === 'fail' || st === 'partial') unmet.set(r.name, (unmet.get(r.name) ?? 0) + 1);
      }
    }
    const aiRuns = evals.filter((e) => e.ai.status !== 'not-requested');
    const issues = state.issues.filter((i) => projectId === 'all' || (projectId === 'none' ? i.projectId === null : i.projectId === projectId));
    const tests = state.testCases.filter((t) => projectId === 'all' || (projectId === 'none' ? t.projectId === null : t.projectId === projectId));
    const ran = tests.filter((t) => t.runs.length > 0);
    return {
      evals,
      unmet: [...unmet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      coverage: criteriaTotal > 0 ? Math.round((criteriaPass / criteriaTotal) * 100) : null,
      aiOk: aiRuns.filter((e) => e.ai.status === 'ok').length,
      aiFailed: aiRuns.filter((e) => e.ai.status === 'failed').length,
      tokensIn: aiRuns.reduce((a, e) => a + e.ai.inputTokens, 0),
      tokensOut: aiRuns.reduce((a, e) => a + e.ai.outputTokens, 0),
      issuesTotal: issues.length,
      issuesResolved: issues.filter((i) => i.status === 'resolved').length,
      testsRan: ran.length,
      testsPassing: ran.filter((t) => t.runs[t.runs.length - 1].result === 'pass').length,
    };
  }, [state.evaluations, state.issues, state.testCases, projectId]);

  return (
    <>
      <PageHeader title="Analytics" sub="Computed from the evaluations, issues and tests stored in this workspace. No sample data." />
      <div className="row" style={{ marginBottom: 12 }}>
        <label>Project
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All</option><option value="none">Unassigned</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      {data.evals.length === 0 ? (
        <Empty title="No evaluations to analyse" hint="Run an evaluation and its results will appear here." />
      ) : (
        <div className="stack">
          <div className="grid grid-4">
            <div className="stat blue"><b>{data.evals.length}</b><span>Evaluations</span></div>
            <div className="stat gold"><b>{data.coverage === null ? 'No data' : `${data.coverage}%`}</b><span>Scored criteria passing</span></div>
            <div className="stat"><b>{data.issuesTotal === 0 ? 'No data' : `${Math.round((data.issuesResolved / data.issuesTotal) * 100)}%`}</b><span>Issues resolved ({data.issuesResolved} of {data.issuesTotal})</span></div>
            <div className="stat violet"><b>{data.testsRan === 0 ? 'No data' : `${Math.round((data.testsPassing / data.testsRan) * 100)}%`}</b><span>Tests passing on last run ({data.testsPassing} of {data.testsRan})</span></div>
          </div>

          <Card title="Verdict internal score over time">
            <Trend scores={data.evals.map((e) => e.overallScore)} />
          </Card>

          <div className="grid grid-2">
            <Card title="Verdicts">
              <div className="stack">
                {VERDICTS.map((v) => (
                  <div key={v} className="row" style={{ justifyContent: 'space-between' }}>
                    <VerdictBadge v={v} /><span>{data.evals.filter((e) => e.verdict === v).length}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Most frequently unmet criteria">
              {data.unmet.length === 0 ? <p className="muted">No failed or partial criteria recorded.</p> : (
                <div className="stack">
                  {data.unmet.map(([name, n]) => <div key={name} className="row" style={{ justifyContent: 'space-between' }}><span>{name}</span><span>{n}</span></div>)}
                </div>
              )}
            </Card>
          </div>

          <Card title="AI usage">
            <p>{data.aiOk} completed and {data.aiFailed} failed AI runs. {data.tokensIn.toLocaleString()} input and {data.tokensOut.toLocaleString()} output tokens.</p>
            <p className="muted">Cost in currency is not tracked because Verdict does not know your provider pricing. Multiply the token counts by your own rates.</p>
          </Card>
        </div>
      )}
    </>
  );
}
