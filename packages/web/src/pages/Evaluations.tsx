import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, PageHeader, VerdictBadge, fmtDate } from '../components/ui';
import type { Verdict } from '../lib/types';

const VERDICTS: Verdict[] = ['PASS', 'CONDITIONAL PASS', 'NEEDS REVIEW', 'FAIL'];

export default function Evaluations() {
  const { state, update } = useStore();
  const [verdict, setVerdict] = useState<'all' | Verdict>('all');
  const [projectId, setProjectId] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo(
    () =>
      state.evaluations.filter(
        (e) =>
          (verdict === 'all' || e.verdict === verdict) &&
          (projectId === 'all' || (projectId === 'none' ? e.projectId === null : e.projectId === projectId)) &&
          (q.trim() === '' || e.title.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [state.evaluations, verdict, projectId, q],
  );

  function remove(id: string) {
    if (!window.confirm('Delete this evaluation? Its issues are kept but lose their evidence link.')) return;
    update((s) => ({
      ...s,
      evaluations: s.evaluations.filter((e) => e.id !== id),
      projects: s.projects.map((p) => (p.baselineEvaluationId === id ? { ...p, baselineEvaluationId: null } : p)),
    }));
  }

  return (
    <>
      <PageHeader title="Evaluations" sub="Every verdict links to its rubric version, evidence and audit history." actions={<Link to="/evaluate" className="btn btn-primary">New evaluation</Link>} />
      <Card>
        <div className="row" style={{ marginBottom: 12 }}>
          <label style={{ minWidth: 200 }}>Search<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title contains..." /></label>
          <label>Verdict
            <select value={verdict} onChange={(e) => setVerdict(e.target.value as 'all' | Verdict)}>
              <option value="all">All</option>
              {VERDICTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="all">All</option>
              <option value="none">Unassigned</option>
              {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        {state.evaluations.length === 0 ? (
          <Empty title="No evaluations yet" hint="Run one to see scores, evidence and recommended fixes." />
        ) : rows.length === 0 ? (
          <Empty title="No evaluations match these filters" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Rubric</th><th>Score</th><th>Verdict</th><th>When</th><th /></tr></thead>
              <tbody>
                {rows.map((e) => {
                  const project = state.projects.find((p) => p.id === e.projectId);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/evaluations/${e.id}`}>{e.title}</Link>
                        <div className="row">
                          {project ? <Badge tone="blue">{project.name}</Badge> : null}
                          {e.parentId ? <Badge tone="violet">Re-evaluation</Badge> : null}
                          {e.ai.status === 'failed' ? <Badge tone="bad">AI failed</Badge> : null}
                        </div>
                      </td>
                      <td>{e.rubricName} v{e.rubricVersion}</td>
                      <td>{e.overallScore}</td>
                      <td><VerdictBadge v={e.verdict} /></td>
                      <td className="muted">{fmtDate(e.createdAt)}</td>
                      <td><button type="button" className="btn btn-sm btn-danger" onClick={() => remove(e.id)}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
