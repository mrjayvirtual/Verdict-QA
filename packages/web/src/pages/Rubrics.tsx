import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, Notice, PageHeader, fmtDate } from '../components/ui';
import { parseRubricText, type ParseResult } from '../lib/rubricParser';
import { scanInjection } from '../lib/safety';
import { authHeaders } from '../lib/ai';
import { download, rubricToCsv, rubricToMarkdown, slug } from '../lib/exporters';
import { nowIso, uid } from '../lib/text';
import type { Rubric, SourceStatus, Verification } from '../lib/types';

type Mode = 'paste' | 'url';
type Msg = { tone: 'good' | 'warn' | 'bad'; text: string } | null;

function apiError(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) return String((body as { error: unknown }).error);
  return `Request failed (HTTP ${status}).`;
}

export default function Rubrics() {
  const { state, update } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>('paste');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  async function fetchUrl() {
    setMsg(null);
    setPreview(null);
    let u: URL;
    try {
      u = new URL(url.trim());
    } catch {
      setMsg({ tone: 'bad', text: 'Enter a full URL starting with https://.' });
      return;
    }
    if (u.protocol !== 'https:') {
      setMsg({ tone: 'bad', text: 'Only https:// sources are supported.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/source', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: u.toString() }) });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiError(body, res.status));
      const data = body as { text?: unknown; fetchedAt?: unknown; truncated?: unknown };
      if (typeof data.text !== 'string' || data.text.trim().length === 0) throw new Error('The page returned no readable text.');
      setText(data.text);
      setFetchedAt(typeof data.fetchedAt === 'string' ? data.fetchedAt : nowIso());
      setMsg({ tone: 'good', text: `Fetched ${data.text.length.toLocaleString()} characters${data.truncated ? ' (truncated)' : ''}. Review the text, then extract criteria.` });
    } catch (e) {
      setMsg({ tone: 'bad', text: `${e instanceof Error ? e.message : 'Fetch failed.'} You can paste the rules into the box instead.` });
    } finally {
      setBusy(false);
    }
  }

  function extract() {
    const verification: Verification = mode === 'url' ? 'unverified' : 'user-provided';
    const result = parseRubricText(text, mode === 'url' ? url.trim() : '', verification);
    setPreview(result);
    setFlags(scanInjection(text));
    setMsg(
      result.criteria.length === 0
        ? { tone: 'warn', text: 'No official rubric was found in this text. You can still save an empty rubric and add criteria by hand, or paste the actual rules.' }
        : null,
    );
  }

  function save() {
    if (!preview) return;
    const n = name.trim();
    if (!n) {
      setMsg({ tone: 'bad', text: 'Give the rubric a name first.' });
      return;
    }
    const sourceStatus: SourceStatus = preview.criteria.length === 0 ? 'not-found' : mode === 'url' ? 'url' : 'user-provided';
    const at = nowIso();
    const rubric: Rubric = {
      id: uid(),
      name: n,
      sourceUrl: mode === 'url' ? url.trim() : '',
      sourceStatus,
      sourceNote: preview.notes.join(' '),
      fetchedAt: mode === 'url' ? fetchedAt : null,
      createdAt: at,
      updatedAt: at,
      version: 1,
      criteria: preview.criteria,
      history: [],
    };
    update((s) => ({ ...s, rubrics: [rubric, ...s.rubrics] }));
    nav(`/rubrics/${rubric.id}`);
  }

  function blank() {
    const n = name.trim() || 'Untitled rubric';
    const at = nowIso();
    const rubric: Rubric = { id: uid(), name: n, sourceUrl: '', sourceStatus: 'not-found', sourceNote: 'Created by hand. No official source supplied.', fetchedAt: null, createdAt: at, updatedAt: at, version: 1, criteria: [], history: [] };
    update((s) => ({ ...s, rubrics: [rubric, ...s.rubrics] }));
    nav(`/rubrics/${rubric.id}`);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setMsg({ tone: 'bad', text: 'That file is larger than 1 MB.' });
      return;
    }
    if (/\.(pdf|docx?|pptx?)$/i.test(file.name)) {
      setMsg({ tone: 'warn', text: 'PDF and Word files cannot be read yet. Copy their text and paste it here.' });
      return;
    }
    setMode('paste');
    setText(await file.text());
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    setPreview(null);
    setMsg({ tone: 'good', text: `Loaded ${file.name}. Extract criteria when ready.` });
  }

  function remove(id: string) {
    if (!window.confirm('Delete this rubric? Existing evaluations keep their results.')) return;
    update((s) => ({ ...s, rubrics: s.rubrics.filter((r) => r.id !== id), projects: s.projects.map((p) => (p.rubricId === id ? { ...p, rubricId: null } : p)) }));
  }

  return (
    <>
      <PageHeader
        title="Rubric Intelligence"
        sub="What's the competition's judging rubric? Provide the official text and Verdict structures it without inventing anything."
      />

      <Card title="Add a rubric">
        <div className="stack">
          <div className="tabs">
            <button type="button" className={`tab ${mode === 'paste' ? 'on' : ''}`} onClick={() => setMode('paste')}>Paste or upload rules</button>
            <button type="button" className={`tab ${mode === 'url' ? 'on' : ''}`} onClick={() => setMode('url')}>From a public URL</button>
          </div>

          <label>Rubric name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring AI Challenge judging criteria" /></label>

          {mode === 'url' ? (
            <div className="row">
              <label style={{ flex: 1, minWidth: 240 }}>Official page URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
              <button type="button" className="btn" disabled={busy || !url.trim()} onClick={fetchUrl} style={{ alignSelf: 'flex-end' }}>{busy ? 'Fetching...' : 'Fetch page'}</button>
            </div>
          ) : (
            <label>Upload a text file (.txt, .md, .csv, .json, .html)<input type="file" accept=".txt,.md,.csv,.json,.html,.htm" onChange={(e) => onFile(e.target.files?.[0])} /></label>
          )}

          <label>Rules text<textarea value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder={'Paste the judging criteria, for example:\n1. Innovation - 30%\n2. Technical execution - 30%: working demo and clean code\n- Submissions without a public repository will be disqualified.'} /></label>

          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          {mode === 'url' ? <Notice tone="blue">Fetched criteria are marked unverified until you confirm them against the official source. Verdict cannot tell whether a page is official.</Notice> : null}

          <div className="row">
            <button type="button" className="btn btn-primary" disabled={text.trim().length < 8} onClick={extract}>Extract criteria</button>
            <button type="button" className="btn" onClick={blank}>Start a blank rubric</button>
          </div>
        </div>
      </Card>

      {preview ? (
        <div style={{ marginTop: 14 }}>
          <Card title={`Preview: ${preview.criteria.length} criteria found`} actions={<button type="button" className="btn btn-primary" onClick={save}>Save rubric</button>}>
            <div className="stack">
              {flags.length > 0 ? <Notice tone="bad">This text contains phrases that try to instruct an AI evaluator: {flags.join('; ')}. It is treated as data only. Review it before trusting the extraction.</Notice> : null}
              {preview.notes.map((n) => <Notice key={n} tone="warn">{n}</Notice>)}
              {preview.criteria.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Criterion</th><th>Weight</th><th>Type</th><th>Parser confidence</th></tr></thead>
                    <tbody>
                      {preview.criteria.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong><div className="muted">{c.officialWording}</div></td>
                          <td>{c.weight ?? 'Not specified'}</td>
                          <td>{c.disqualifying ? <Badge tone="bad">Disqualification rule</Badge> : c.required ? <Badge tone="gold">Required</Badge> : <Badge>Scored</Badge>}</td>
                          <td>{Math.round(c.confidence * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="stack" style={{ marginTop: 14 }}>
        <h2>Your rubrics</h2>
        {state.rubrics.length === 0 ? (
          <Empty title="No rubrics yet" hint="Paste official judging criteria above, or start a blank rubric." />
        ) : (
          state.rubrics.map((r) => {
            const stale = state.evaluations.filter((e) => e.rubricId === r.id && e.rubricVersion < r.version).length;
            return (
              <Card
                key={r.id}
                title={`${r.name} (v${r.version})`}
                actions={
                  <>
                    <Link className="btn btn-sm" to={`/rubrics/${r.id}`}>Open and edit</Link>
                    <button type="button" className="btn btn-sm" onClick={() => download(`${slug(r.name)}.json`, JSON.stringify(r, null, 2), 'application/json')}>JSON</button>
                    <button type="button" className="btn btn-sm" onClick={() => download(`${slug(r.name)}.csv`, rubricToCsv(r), 'text/csv')}>CSV</button>
                    <button type="button" className="btn btn-sm" onClick={() => download(`${slug(r.name)}.md`, rubricToMarkdown(r), 'text/markdown')}>Report</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>Delete</button>
                  </>
                }
              >
                <div className="row">
                  <Badge tone="blue">{r.criteria.length} criteria</Badge>
                  <Badge tone={r.sourceStatus === 'not-found' ? 'warn' : 'neutral'}>{r.sourceStatus === 'not-found' ? 'No official source recorded' : r.sourceStatus === 'url' ? 'From URL' : 'User provided'}</Badge>
                  {stale > 0 ? <Badge tone="warn">{stale} evaluations on older versions</Badge> : null}
                  <span className="muted">Updated {fmtDate(r.updatedAt)}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
