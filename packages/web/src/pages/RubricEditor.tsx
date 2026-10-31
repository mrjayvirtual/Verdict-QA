import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, Notice, PageHeader, fmtDate } from '../components/ui';
import { nowIso, uid } from '../lib/text';
import type { Criterion, Rubric, Verification } from '../lib/types';

const VERIFICATIONS: Verification[] = ['unverified', 'user-provided', 'verified', 'inferred'];

function diffCriteria(a: Criterion[], b: Criterion[]): string[] {
  const out: string[] = [];
  const before = new Map(a.map((c) => [c.name, c]));
  const after = new Map(b.map((c) => [c.name, c]));
  for (const c of b) if (!before.has(c.name)) out.push(`Added: ${c.name}`);
  for (const c of a) {
    const n = after.get(c.name);
    if (!n) {
      out.push(`Removed: ${c.name}`);
      continue;
    }
    if (n.weight !== c.weight) out.push(`${c.name}: weight ${c.weight ?? 'Not specified'} to ${n.weight ?? 'Not specified'}`);
    if (n.officialWording !== c.officialWording) out.push(`${c.name}: official wording changed`);
    if (n.required !== c.required || n.disqualifying !== c.disqualifying) out.push(`${c.name}: requirement flags changed`);
  }
  return out;
}

const blankCriterion = (): Criterion => ({
  id: uid(),
  name: 'New criterion',
  officialWording: '',
  description: '',
  weight: null,
  scale: 'Not specified',
  requiredEvidence: [],
  required: false,
  disqualifying: false,
  keywords: [],
  sourceUrl: '',
  verification: 'user-provided',
  confidence: 1,
  ambiguities: '',
});

export default function RubricEditor() {
  const { id } = useParams();
  const { state, update } = useStore();
  const rubric = state.rubrics.find((r) => r.id === id);
  const [draft, setDraft] = useState<Rubric | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (rubric) setDraft(structuredClone(rubric));
  }, [rubric?.id, rubric?.version]);

  if (!rubric || !draft) {
    return <Empty title="Rubric not found" hint="It may have been deleted."><Link to="/rubrics">Back to rubrics</Link></Empty>;
  }

  const criteriaChanged = JSON.stringify(rubric.criteria) !== JSON.stringify(draft.criteria);
  const dirty = criteriaChanged || draft.name !== rubric.name || draft.sourceUrl !== rubric.sourceUrl || draft.sourceNote !== rubric.sourceNote;
  const stale = state.evaluations.filter((e) => e.rubricId === rubric.id && e.rubricVersion < rubric.version);

  function setCrit(i: number, patch: Partial<Criterion>) {
    setDraft((d) => (d ? { ...d, criteria: d.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) } : d));
  }

  function save() {
    if (!draft || !rubric) return;
    if (draft.criteria.some((c) => !c.name.trim())) {
      setError('Every criterion needs a name.');
      return;
    }
    if (draft.criteria.some((c) => c.weight !== null && (!Number.isFinite(c.weight) || c.weight < 0))) {
      setError('Weights must be zero or more, or left blank for "Not specified".');
      return;
    }
    setError(null);
    const at = nowIso();
    const changes = diffCriteria(rubric.criteria, draft.criteria);
    update((s) => ({
      ...s,
      rubrics: s.rubrics.map((r) =>
        r.id !== rubric.id
          ? r
          : {
              ...draft,
              updatedAt: at,
              version: criteriaChanged ? r.version + 1 : r.version,
              history: criteriaChanged
                ? [...r.history, { version: r.version, savedAt: r.updatedAt, note: note.trim() || changes.slice(0, 3).join('; ') || 'Edited', criteria: r.criteria }]
                : r.history,
            },
      ),
    }));
    setNote('');
    setSavedAt(at);
  }

  return (
    <>
      <PageHeader
        title={`${rubric.name} (v${rubric.version})`}
        sub="Edit criteria as the official rules change. Each change to the criteria creates a new version."
        actions={<Link className="btn" to="/rubrics">Back</Link>}
      />

      {rubric.sourceStatus === 'not-found' && rubric.criteria.length === 0 ? (
        <Notice tone="warn">No official rubric was found or supplied for this entry. Add the criteria from the official rules by hand. Verdict will not invent them.</Notice>
      ) : null}
      {stale.length > 0 ? (
        <div style={{ marginTop: 10 }}><Notice tone="warn">{stale.length} past evaluations used an older version of this rubric. Re-evaluate them to see the impact of the change.</Notice></div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <Card title="Source">
          <div className="grid grid-2">
            <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label>Official source URL<input value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} placeholder="Not specified" /></label>
          </div>
          <label style={{ marginTop: 10 }}>Notes about the source<input value={draft.sourceNote} onChange={(e) => setDraft({ ...draft, sourceNote: e.target.value })} /></label>
          {rubric.fetchedAt ? <p className="muted">Retrieved {fmtDate(rubric.fetchedAt)}</p> : null}
        </Card>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {draft.criteria.length === 0 ? <Empty title="No criteria yet" hint="Add the first criterion below." /> : null}
        {draft.criteria.map((c, i) => (
          <div key={c.id} className="criterion">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="row">
                <strong>{c.name || 'Untitled'}</strong>
                {c.disqualifying ? <Badge tone="bad">Disqualification rule</Badge> : c.required ? <Badge tone="gold">Required</Badge> : null}
                <Badge tone={c.verification === 'verified' ? 'good' : 'warn'}>{c.verification}</Badge>
              </div>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setDraft({ ...draft, criteria: draft.criteria.filter((_, idx) => idx !== i) })}>Remove</button>
            </div>
            <div className="grid grid-3">
              <label>Name<input value={c.name} onChange={(e) => setCrit(i, { name: e.target.value })} /></label>
              <label>Weight (blank = Not specified)
                <input type="number" min="0" step="any" value={c.weight ?? ''} disabled={c.disqualifying} onChange={(e) => setCrit(i, { weight: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label>Scoring scale<input value={c.scale} onChange={(e) => setCrit(i, { scale: e.target.value })} /></label>
            </div>
            <label style={{ marginTop: 10 }}>Official wording (verbatim from the source)<textarea style={{ minHeight: 60 }} value={c.officialWording} onChange={(e) => setCrit(i, { officialWording: e.target.value })} /></label>
            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <label>Description<input value={c.description} onChange={(e) => setCrit(i, { description: e.target.value })} /></label>
              <label>Matching keywords (comma separated)<input value={c.keywords.join(', ')} onChange={(e) => setCrit(i, { keywords: e.target.value.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) })} /></label>
            </div>
            <label style={{ marginTop: 10 }}>Required evidence (one per line)<textarea style={{ minHeight: 60 }} value={c.requiredEvidence.join('\n')} onChange={(e) => setCrit(i, { requiredEvidence: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })} /></label>
            <div className="grid grid-3" style={{ marginTop: 10 }}>
              <label>Source URL<input value={c.sourceUrl} onChange={(e) => setCrit(i, { sourceUrl: e.target.value })} placeholder="Not specified" /></label>
              <label>Verification status
                <select value={c.verification} onChange={(e) => setCrit(i, { verification: e.target.value as Verification })}>
                  {VERIFICATIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label>Ambiguities<input value={c.ambiguities} onChange={(e) => setCrit(i, { ambiguities: e.target.value })} /></label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="check"><input type="checkbox" checked={c.required} onChange={(e) => setCrit(i, { required: e.target.checked })} />Required (failing it fails the verdict)</label>
              <label className="check"><input type="checkbox" checked={c.disqualifying} onChange={(e) => setCrit(i, { disqualifying: e.target.checked, required: e.target.checked ? true : c.required, weight: e.target.checked ? null : c.weight })} />Eligibility or disqualification rule</label>
            </div>
          </div>
        ))}
        <div><button type="button" className="btn" onClick={() => setDraft({ ...draft, criteria: [...draft.criteria, blankCriterion()] })}>Add criterion</button></div>
      </div>

      <div className="save-bar row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ flex: 1 }}>
          <input placeholder="What changed? (optional, saved with the version)" value={note} onChange={(e) => setNote(e.target.value)} style={{ maxWidth: 420 }} />
          {error ? <Badge tone="bad">{error}</Badge> : null}
          {!error && savedAt && !dirty ? <Badge tone="good">Saved</Badge> : null}
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={!dirty} onClick={() => setDraft(structuredClone(rubric))}>Discard changes</button>
          <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}>{criteriaChanged ? 'Save as new version' : 'Save'}</button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card title="Version history">
          {rubric.history.length === 0 ? (
            <p className="muted">This is the first version. Changes to criteria will be tracked here.</p>
          ) : (
            <div className="stack">
              {[...rubric.history].reverse().map((h) => {
                const idx = rubric.history.findIndex((x) => x.version === h.version);
                const next = rubric.history[idx + 1]?.criteria ?? rubric.criteria;
                const changes = diffCriteria(h.criteria, next);
                return (
                  <details key={h.version}>
                    <summary>v{h.version} replaced on {fmtDate(h.savedAt)}: {h.note}</summary>
                    {changes.length === 0 ? <p className="muted">No criterion-level differences detected.</p> : <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul>}
                  </details>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
