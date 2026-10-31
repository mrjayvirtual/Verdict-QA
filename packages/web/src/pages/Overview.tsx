import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Card, Empty, PageHeader, VerdictBadge, fmtDate } from '../components/ui';
import type { Verdict } from '../lib/types';

const VERDICTS: Verdict[] = ['PASS', 'CONDITIONAL PASS', 'NEEDS REVIEW', 'FAIL'];

export default function Overview() {
  const { state } = useStore();
  const { rubrics, evaluations, issues, projects, testCases } = state;

  const openIssues = issues.filter((i) => i.status === 'open').length;
  const resolved = issues.filter((i) => i.status === 'resolved').length;
  const avg = evaluations.length > 0 ? Math.round(evaluations.reduce((a, e) => a + e.overallScore, 0) / evaluations.length) : null;
  const recent = evaluations.slice(0, 5);

  const steps = [
    { done: rubrics.length > 0, label: 'Create a rubric from the competition rules', to: '/rubrics' },
    { done: projects.length > 0, label: 'Create a project to track a submission', to: '/projects' },
    { done: evaluations.length > 0, label: 'Run your first evaluation', to: '/evaluate' },
    { done: evaluations.some((e) => e.parentId !== null), label: 'Fix the gaps and re-evaluate to compare', to: '/evaluations' },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        sub="What's the competition's judging rubric? Start there, then evaluate, fix and verify."
        actions={
          <Link to="/evaluate" className="btn btn-primary">
            New evaluation
          </Link>
        }
      />

      <div className="grid grid-4">
        <div className="stat blue"><b>{rubrics.length}</b><span>Rubrics</span></div>
        <div className="stat violet"><b>{evaluations.length}</b><span>Evaluations</span></div>
        <div className="stat gold"><b>{avg === null ? 'No data' : avg}</b><span>Average internal score</span></div>
        <div className="stat"><b>{openIssues}</b><span>Open issues ({resolved} resolved)</span></div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Card title="Getting started">
          <div className="stack">
            {steps.map((s) => (
              <div key={s.label} className="row">
                <span className={`badge ${s.done ? 'badge-good' : 'badge-neutral'}`}>{s.done ? 'Done' : 'To do'}</span>
                <Link to={s.to}>{s.label}</Link>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Verdict distribution">
          {evaluations.length === 0 ? (
            <Empty title="No evaluations yet" hint="Distribution appears after your first evaluation." />
          ) : (
            <div className="stack">
              {VERDICTS.map((v) => {
                const n = evaluations.filter((e) => e.verdict === v).length;
                return (
                  <div key={v} className="row" style={{ justifyContent: 'space-between' }}>
                    <VerdictBadge v={v} />
                    <span>{n}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card title="Recent evaluations" actions={<Link to="/evaluations">View all</Link>}>
          {recent.length === 0 ? (
            <Empty title="Nothing evaluated yet" hint="Create a rubric, then run an evaluation against a submission." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Title</th><th>Rubric</th><th>Score</th><th>Verdict</th><th>When</th></tr>
                </thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id}>
                      <td><Link to={`/evaluations/${e.id}`}>{e.title}</Link></td>
                      <td>{e.rubricName} v{e.rubricVersion}</td>
                      <td>{e.overallScore}</td>
                      <td><VerdictBadge v={e.verdict} /></td>
                      <td className="muted">{fmtDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p className="muted" style={{ marginTop: 14 }}>
        {testCases.length} test cases logged. All data is stored in this browser unless you export it from Settings.
      </p>
    </>
  );
}
