import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, PageHeader, VerdictBadge } from '../components/ui';
import { compareEvaluations } from '../lib/remediation';
import { nowIso, uid } from '../lib/text';

export default function Projects() {
  const { state, update } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rubricId, setRubricId] = useState('');

  function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    update((s) => ({
      ...s,
      projects: [
        { id: uid(), name: n, description: description.trim(), rubricId: rubricId || null, baselineEvaluationId: null, createdAt: nowIso() },
        ...s.projects,
      ],
    }));
    setName('');
    setDescription('');
    setRubricId('');
  }

  function remove(id: string) {
    if (!window.confirm('Delete this project? Its evaluations, issues and test cases are kept but become unassigned.')) return;
    update((s) => ({
      ...s,
      projects: s.projects.filter((p) => p.id !== id),
      evaluations: s.evaluations.map((ev) => (ev.projectId === id ? { ...ev, projectId: null } : ev)),
      issues: s.issues.map((i) => (i.projectId === id ? { ...i, projectId: null } : i)),
      testCases: s.testCases.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
    }));
  }

  function setProjectRubric(id: string, value: string) {
    update((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, rubricId: value || null } : p)) }));
  }

  return (
    <>
      <PageHeader title="Projects" sub="Group evaluations, issues and tests for one submission. Set a baseline to enable the regression gate." />

      <Card title="New project">
        <form className="grid grid-3" onSubmit={add}>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hackathon entry" required /></label>
          <label>Default rubric
            <select value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
              <option value="">None</option>
              {state.rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></label>
          <div><button type="submit" className="btn btn-primary">Create project</button></div>
        </form>
      </Card>

      <div className="stack" style={{ marginTop: 14 }}>
        {state.projects.length === 0 ? (
          <Empty title="No projects yet" hint="Create one above. Evaluations can also run without a project." />
        ) : (
          state.projects.map((p) => {
            const evals = state.evaluations.filter((e) => e.projectId === p.id);
            const latest = evals[0];
            const baseline = state.evaluations.find((e) => e.id === p.baselineEvaluationId);
            const gate = baseline && latest && baseline.id !== latest.id ? compareEvaluations(baseline, latest, state.settings.regressionTolerance) : null;
            const open = state.issues.filter((i) => i.projectId === p.id && i.status === 'open').length;
            return (
              <Card
                key={p.id}
                title={p.name}
                actions={<button type="button" className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>Delete</button>}
              >
                {p.description ? <p className="muted">{p.description}</p> : null}
                <div className="row" style={{ margin: '8px 0' }}>
                  <Badge tone="blue">{evals.length} evaluations</Badge>
                  <Badge tone={open > 0 ? 'warn' : 'good'}>{open} open issues</Badge>
                  {latest ? <VerdictBadge v={latest.verdict} /> : <Badge>No evaluation yet</Badge>}
                  {gate ? <Badge tone={gate.gate === 'CLEARED' ? 'good' : 'bad'}>Regression gate: {gate.gate}</Badge> : null}
                  {baseline ? null : <Badge>No baseline set</Badge>}
                </div>
                {gate && gate.gateReasons.length > 0 ? <p className="muted">{gate.gateReasons.join(' ')}</p> : null}
                <div className="row">
                  <label style={{ minWidth: 220 }}>Default rubric
                    <select value={p.rubricId ?? ''} onChange={(e) => setProjectRubric(p.id, e.target.value)}>
                      <option value="">None</option>
                      {state.rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                  {latest ? <Link to={`/evaluations/${latest.id}`}>Open latest evaluation</Link> : <Link to="/evaluate">Run an evaluation</Link>}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
