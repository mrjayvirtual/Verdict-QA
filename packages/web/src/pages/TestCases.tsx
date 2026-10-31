import { useState, type FormEvent } from 'react';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, Notice, PageHeader, fmtDate } from '../components/ui';
import { nowIso, uid } from '../lib/text';
import type { TestRun } from '../lib/types';

const TONE = { pass: 'good', fail: 'bad', blocked: 'warn' } as const;

export default function TestCases() {
  const { state, update } = useStore();
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [logged, setLogged] = useState<string | null>(null);

  const rows = state.testCases.filter((t) => filter === 'all' || (filter === 'none' ? t.projectId === null : t.projectId === filter));

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !expected.trim()) return;
    update((s) => ({
      ...s,
      testCases: [{ id: uid(), projectId: projectId || null, title: title.trim(), steps: steps.trim(), expected: expected.trim(), createdAt: nowIso(), runs: [] }, ...s.testCases],
    }));
    setTitle('');
    setSteps('');
    setExpected('');
  }

  function record(id: string, result: TestRun['result']) {
    const note = (notes[id] ?? '').trim();
    update((s) => ({
      ...s,
      testCases: s.testCases.map((t) => (t.id === id ? { ...t, runs: [...t.runs, { at: nowIso(), result, note }] } : t)),
    }));
    setNotes((n) => ({ ...n, [id]: '' }));
  }

  function logIssue(id: string) {
    const t = state.testCases.find((x) => x.id === id);
    if (!t) return;
    const last = t.runs[t.runs.length - 1];
    update((s) => ({
      ...s,
      issues: [
        {
          id: uid(), projectId: t.projectId, evaluationId: '', rubricId: '', criterionId: '',
          title: `Test failed: ${t.title}`,
          detail: `Expected: ${t.expected}${last?.note ? ` | Observed: ${last.note}` : ''}`,
          severity: 'medium', status: 'open', createdAt: nowIso(), resolvedAt: null, resolvedByEvaluationId: null, note: '', manual: true,
        },
        ...s.issues,
      ],
    }));
    setLogged(id);
  }

  function remove(id: string) {
    if (!window.confirm('Delete this test case and its run history?')) return;
    update((s) => ({ ...s, testCases: s.testCases.filter((t) => t.id !== id) }));
  }

  return (
    <>
      <PageHeader title="Test cases" sub="Define checks, record each manual execution and keep the run history. Automated execution is not implemented yet." />
      <Card title="New test case">
        <form className="stack" onSubmit={add}>
          <div className="grid grid-2">
            <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>Project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <label>Steps<textarea style={{ minHeight: 70 }} value={steps} onChange={(e) => setSteps(e.target.value)} /></label>
          <label>Expected result<input value={expected} onChange={(e) => setExpected(e.target.value)} required /></label>
          <div><button type="submit" className="btn btn-primary">Add test case</button></div>
        </form>
      </Card>

      <div className="row" style={{ margin: '16px 0 10px' }}>
        <label>Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All test cases</option>
            <option value="none">Unassigned</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <div className="stack">
        {rows.length === 0 ? <Empty title="No test cases" hint="Add one above to start recording executions." /> : null}
        {rows.map((t) => {
          const last = t.runs[t.runs.length - 1];
          return (
            <Card key={t.id} title={t.title} actions={<button type="button" className="btn btn-sm btn-danger" onClick={() => remove(t.id)}>Delete</button>}>
              <div className="row">
                {last ? <Badge tone={TONE[last.result]}>Last run: {last.result}</Badge> : <Badge>Not run</Badge>}
                <Badge tone="blue">{t.runs.length} runs</Badge>
              </div>
              {t.steps ? <p style={{ whiteSpace: 'pre-wrap' }}><strong>Steps:</strong> {t.steps}</p> : null}
              <p><strong>Expected:</strong> {t.expected}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <input style={{ maxWidth: 320 }} placeholder="Observed result or note (optional)" value={notes[t.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))} />
                <button type="button" className="btn btn-sm" onClick={() => record(t.id, 'pass')}>Record pass</button>
                <button type="button" className="btn btn-sm" onClick={() => record(t.id, 'fail')}>Record fail</button>
                <button type="button" className="btn btn-sm" onClick={() => record(t.id, 'blocked')}>Record blocked</button>
                {last?.result === 'fail' ? <button type="button" className="btn btn-sm" onClick={() => logIssue(t.id)}>Log issue</button> : null}
              </div>
              {logged === t.id ? <div style={{ marginTop: 8 }}><Notice tone="good">Issue logged. See the Issues page.</Notice></div> : null}
              {t.runs.length > 0 ? (
                <details style={{ marginTop: 10 }}>
                  <summary>Run history</summary>
                  <ul>{[...t.runs].reverse().map((r, i) => <li key={i}>{fmtDate(r.at)} | {r.result}{r.note ? ` | ${r.note}` : ''}</li>)}</ul>
                </details>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
