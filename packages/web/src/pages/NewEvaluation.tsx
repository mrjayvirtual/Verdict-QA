import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Card, Empty, Notice, PageHeader } from '../components/ui';
import { buildEvaluation, emptyAi, runDeterministic } from '../lib/engine';
import { applyJudges, runJudges } from '../lib/ai';
import { syncIssues } from '../lib/remediation';
import { scanInjection } from '../lib/safety';
import type { AiRun, SubmissionKind } from '../lib/types';

const KINDS: [SubmissionKind, string][] = [
  ['document', 'Document or text'],
  ['ai-response', 'AI-generated response'],
  ['code', 'Source code or repository notes'],
  ['competition', 'Competition submission'],
  ['qa-data', 'QA dataset or test results'],
];

export default function NewEvaluation() {
  const { state, update } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const parent = state.evaluations.find((e) => e.id === params.get('from')) ?? null;

  const [projectId, setProjectId] = useState<string>(parent?.projectId ?? '');
  const [rubricId, setRubricId] = useState<string>(parent?.rubricId ?? state.rubrics[0]?.id ?? '');
  const [kind, setKind] = useState<SubmissionKind>(parent?.kind ?? 'document');
  const [title, setTitle] = useState(parent ? parent.title.replace(/ \(re-evaluation.*\)$/, '') : '');
  const [submission, setSubmission] = useState(parent?.submission ?? '');
  const [official, setOfficial] = useState('');
  const [wantAi, setWantAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rubric = state.rubrics.find((r) => r.id === rubricId);

  function pickProject(id: string) {
    setProjectId(id);
    const p = state.projects.find((x) => x.id === id);
    if (p?.rubricId) setRubricId(p.rubricId);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setError('That file is larger than 1 MB.');
      return;
    }
    if (/\.(pdf|docx?|pptx?|zip)$/i.test(file.name)) {
      setError('PDF, Word and archive files cannot be read yet. Paste the text instead.');
      return;
    }
    setError(null);
    setSubmission(await file.text());
    if (!title) setTitle(file.name);
  }

  async function run() {
    setError(null);
    if (!rubric) {
      setError('Choose a rubric first.');
      return;
    }
    if (rubric.criteria.length === 0) {
      setError('This rubric has no criteria. Add them in Rubric Intelligence first.');
      return;
    }
    if (submission.trim().length < 20) {
      setError('Paste or upload at least a short submission (20 characters or more).');
      return;
    }
    setBusy(true);
    try {
      let results = runDeterministic(submission, rubric);
      let ai: AiRun = emptyAi();
      if (wantAi) {
        const { run: aiRun, outs } = await runJudges(submission, kind, rubric.criteria);
        ai = aiRun;
        if (aiRun.status === 'ok') {
          const applied = applyJudges(results, outs, submission);
          results = applied.results;
          ai = { ...aiRun, disagreements: applied.disagreements };
        }
      }
      const finalTitle = title.trim() || `${rubric.name} evaluation`;
      const ev = buildEvaluation(
        {
          projectId: projectId || null,
          rubric,
          kind,
          title: parent ? `${finalTitle} (re-evaluation ${new Date().toLocaleDateString()})` : finalTitle,
          submission,
          parentId: parent?.id ?? null,
          officialScore: official.trim(),
          results,
          ai,
          injectionFlags: scanInjection(submission),
        },
        state.settings,
      );
      update((s) => ({ ...s, evaluations: [ev, ...s.evaluations], issues: syncIssues(s.issues, ev) }));
      nav(`/evaluations/${ev.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The evaluation failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  }

  if (state.rubrics.length === 0) {
    return (
      <>
        <PageHeader title="New evaluation" />
        <Empty title="You need a rubric first" hint="An evaluation scores a submission against a rubric.">
          <Link className="btn btn-primary" to="/rubrics">Create a rubric</Link>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={parent ? 'Re-evaluate' : 'New evaluation'}
        sub={parent ? `Paste the revised submission. Results will be compared with "${parent.title}".` : 'Score a submission against a rubric with evidence for every criterion.'}
      />
      <Card>
        <div className="stack">
          <div className="grid grid-3">
            <label>Rubric
              <select value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
                {state.rubrics.map((r) => <option key={r.id} value={r.id}>{r.name} (v{r.version})</option>)}
              </select>
            </label>
            <label>Project (optional)
              <select value={projectId} onChange={(e) => pickProject(e.target.value)}>
                <option value="">None</option>
                {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Submission type
              <select value={kind} onChange={(e) => setKind(e.target.value as SubmissionKind)}>
                {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-2">
            <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pitch deck text, draft 2" /></label>
            <label>Official score, if you have one (optional)<input value={official} onChange={(e) => setOfficial(e.target.value)} placeholder="e.g. 78/100. Kept separate from Verdict's score." /></label>
          </div>
          <label>Upload a text file (.txt, .md, .json, .csv, code)<input type="file" onChange={(e) => onFile(e.target.files?.[0])} /></label>
          <label>Submission text<textarea style={{ minHeight: 260 }} value={submission} onChange={(e) => setSubmission(e.target.value)} placeholder="Paste the submission here. It is treated as data, never as instructions." /></label>

          <label className="check">
            <input type="checkbox" checked={wantAi} onChange={(e) => setWantAi(e.target.checked)} />
            Also run three independent AI judges (needs server configuration, see Settings)
          </label>
          {wantAi ? <Notice tone="blue">If the AI service is not configured or fails, the evaluation is still saved but marked NEEDS REVIEW. A failed AI call is never counted as a success.</Notice> : <Notice>Without AI judges, Verdict measures how well the submission covers each criterion and cannot confirm quality. A PASS needs AI consensus or a recorded human approval.</Notice>}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>{busy ? 'Evaluating...' : 'Run evaluation'}</button>
            {rubric ? <span className="muted">{rubric.criteria.length} criteria in {rubric.name}</span> : null}
          </div>
        </div>
      </Card>
    </>
  );
}
