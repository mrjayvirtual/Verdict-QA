import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, PageHeader, fmtDate } from '../components/ui';
import { nowIso, uid } from '../lib/text';
import type { IssueStatus, Severity } from '../lib/types';

const SEV_TONE = { high: 'bad', medium: 'warn', low: 'neutral' } as const;
const STATUSES: IssueStatus[] = ['open', 'resolved', 'wontfix'];

export default function Issues() {
  const { state, update } = useStore();
  const [status, setStatus] = useState<'all' | IssueStatus>('open');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [projectId, setProjectId] = useState('all');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [sev, setSev] = useState<Severity>('medium');
  const [newProject, setNewProject] = useState('');

  const rows = state.issues.filter(
    (i) =>
      (status === 'all' || i.status === status) &&
      (severity === 'all' || i.severity === severity) &&
      (projectId === 'all' || (projectId === 'none' ? i.projectId === null : i.projectId === projectId)),
  );

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    update((s) => ({
      ...s,
      issues: [
        { id: uid(), projectId: newProject || null, evaluationId: '', rubricId: '', criterionId: '', title: title.trim(), detail: detail.trim(), severity: sev, status: 'open', createdAt: nowIso(), resolvedAt: null, resolvedByEvaluationId: null, note: '', manual: true },
        ...s.issues,
      ],
    }));
    setTitle('');
    setDetail('');
  }

  function setIssueStatus(id: string, next: IssueStatus) {
    update((s) => ({
      ...s,
      issues: s.issues.map((i) => (i.id === id ? { ...i, status: next, resolvedAt: next === 'open' ? null : nowIso(), resolvedByEvaluationId: next === 'open' ? null : i.resolvedByEvaluationId } : i)),
    }));
  }

  function setNote(id: string, note: string) {
    update((s) => ({ ...s, issues: s.issues.map((i) => (i.id === id ? { ...i, note } : i)) }));
  }

  function remove(id: string) {
    if (!window.confirm('Delete this issue?')) return;
    update((s) => ({ ...s, issues: s.issues.filter((i) => i.id !== id) }));
  }

  return (
    <>
      <PageHeader title="Issues" sub="Opened automatically for unmet criteria, resolved when a re-evaluation passes them. You can also log your own." />
      <Card title="Log an issue">
        <form className="stack" onSubmit={add}>
          <div className="grid grid-3">
            <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>Severity
              <select value={sev} onChange={(e) => setSev(e.target.value as Severity)}>
                <option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
              </select>
            </label>
            <label>Project
              <select value={newProject} onChange={(e) => setNewProject(e.target.value)}>
                <option value="">None</option>
                {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <label>Detail<input value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
          <div><button type="submit" className="btn btn-primary">Add issue</button></div>
        </form>
      </Card>

      <div className="row" style={{ margin: '16px 0 10px' }}>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | IssueStatus)}>
            <option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value as 'all' | Severity)}>
            <option value="all">All</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
        </label>
        <label>Project
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All</option><option value="none">Unassigned</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <div className="stack">
        {rows.length === 0 ? <Empty title="No issues match" hint="Unmet criteria from evaluations appear here automatically." /> : null}
        {rows.map((i) => {
          const ev = state.evaluations.find((e) => e.id === i.evaluationId);
          const fixedBy = state.evaluations.find((e) => e.id === i.resolvedByEvaluationId);
          return (
            <Card key={i.id} title={i.title} actions={<button type="button" className="btn btn-sm btn-danger" onClick={() => remove(i.id)}>Delete</button>}>
              <div className="row">
                <Badge tone={SEV_TONE[i.severity]}>{i.severity}</Badge>
                <Badge tone={i.status === 'open' ? 'warn' : i.status === 'resolved' ? 'good' : 'neutral'}>{i.status}</Badge>
                {i.manual ? <Badge>Manual</Badge> : <Badge tone="violet">From evaluation</Badge>}
                <span className="muted">Opened {fmtDate(i.createdAt)}</span>
              </div>
              {i.detail ? <p>{i.detail}</p> : null}
              <div className="row muted">
                {ev ? <Link to={`/evaluations/${ev.id}`}>Evidence: {ev.title}</Link> : null}
                {fixedBy ? <Link to={`/evaluations/${fixedBy.id}`}>Resolved by: {fixedBy.title}</Link> : null}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <select style={{ width: 140 }} value={i.status} onChange={(e) => setIssueStatus(i.id, e.target.value as IssueStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input style={{ maxWidth: 360 }} placeholder="Note" value={i.note} onChange={(e) => setNote(i.id, e.target.value)} />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
