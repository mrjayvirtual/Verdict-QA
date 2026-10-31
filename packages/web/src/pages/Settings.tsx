import { useState } from 'react';
import { useStore, isState } from '../lib/store';
import { Badge, Card, Notice, PageHeader } from '../components/ui';
import { TOKEN_KEY, authHeaders, getToken } from '../lib/ai';
import { download } from '../lib/exporters';
import { emptyState, type Settings as SettingsType } from '../lib/types';

interface Health {
  tokenValid?: boolean;
  aiConfigured?: boolean;
  model?: string;
  error?: string;
}

export default function Settings() {
  const { state, update, replace } = useStore();
  const [draft, setDraft] = useState<SettingsType>(state.settings);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [token, setToken] = useState(getToken());
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const [dataMsg, setDataMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  function saveThresholds() {
    const { passThreshold: p, conditionalThreshold: c, failThreshold: f, regressionTolerance: t } = draft;
    const ok = [p, c, f, t].every((n) => Number.isFinite(n));
    if (!ok || !(f >= 0 && f < c && c < p && p <= 100)) {
      setMsg({ tone: 'bad', text: 'Thresholds must satisfy 0 <= fail < conditional < pass <= 100.' });
      return;
    }
    if (t < 0 || t > 50) {
      setMsg({ tone: 'bad', text: 'Regression tolerance must be between 0 and 50 points.' });
      return;
    }
    update((s) => ({ ...s, settings: draft }));
    setMsg({ tone: 'good', text: 'Saved. New thresholds apply to evaluations from now on and to any evaluation you edit.' });
  }

  function saveToken() {
    try {
      if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
      else localStorage.removeItem(TOKEN_KEY);
      setHealth(null);
    } catch {
      setHealth({ error: 'This browser blocked storage, so the token could not be saved.' });
    }
  }

  async function check() {
    setChecking(true);
    setHealth(null);
    try {
      const res = await fetch('/api/judge?health=1', { headers: authHeaders() });
      const body = (await res.json().catch(() => null)) as Health | null;
      setHealth(res.ok && body ? body : { error: body?.error ?? `HTTP ${res.status}` });
    } catch {
      setHealth({ error: 'Could not reach /api/judge. Run the app with `vercel dev` or deploy it to use server features.' });
    } finally {
      setChecking(false);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isState(parsed)) throw new Error('This is not a Verdict QA export.');
      if (!window.confirm('Importing replaces everything in this workspace. Continue?')) return;
      replace({ ...emptyState(), ...parsed });
      setDataMsg({ tone: 'good', text: 'Workspace imported.' });
    } catch (e) {
      setDataMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'Import failed.' });
    }
  }

  function num(key: keyof SettingsType, v: string) {
    setDraft((d) => ({ ...d, [key]: v === '' ? Number.NaN : Number(v) }));
  }

  return (
    <>
      <PageHeader title="Settings" sub="Scoring thresholds, AI connection and data management." />
      <div className="stack">
        <Card title="Scoring thresholds">
          <div className="grid grid-4">
            <label>Pass at or above<input type="number" value={Number.isNaN(draft.passThreshold) ? '' : draft.passThreshold} onChange={(e) => num('passThreshold', e.target.value)} /></label>
            <label>Conditional pass at or above<input type="number" value={Number.isNaN(draft.conditionalThreshold) ? '' : draft.conditionalThreshold} onChange={(e) => num('conditionalThreshold', e.target.value)} /></label>
            <label>Fail below<input type="number" value={Number.isNaN(draft.failThreshold) ? '' : draft.failThreshold} onChange={(e) => num('failThreshold', e.target.value)} /></label>
            <label>Regression tolerance (points)<input type="number" value={Number.isNaN(draft.regressionTolerance) ? '' : draft.regressionTolerance} onChange={(e) => num('regressionTolerance', e.target.value)} /></label>
          </div>
          {msg ? <div style={{ marginTop: 10 }}><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
          <div className="row" style={{ marginTop: 10 }}><button type="button" className="btn btn-primary" onClick={saveThresholds}>Save thresholds</button></div>
        </Card>

        <Card title="AI judges and server features">
          <p className="muted">AI judges and URL fetching run on the server and are locked behind an access token that you set as VERDICT_ACCESS_TOKEN. Enter the same token here. It is stored only in this browser.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <label style={{ minWidth: 280 }}>Access token<input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></label>
            <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={saveToken}>Save token</button>
            <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} disabled={checking} onClick={check}>{checking ? 'Checking...' : 'Test connection'}</button>
          </div>
          {health ? (
            <div className="row" style={{ marginTop: 10 }}>
              {health.error ? <Notice tone="bad">{health.error}</Notice> : (
                <>
                  <Badge tone={health.tokenValid ? 'good' : 'bad'}>Token {health.tokenValid ? 'accepted' : 'rejected'}</Badge>
                  <Badge tone={health.aiConfigured ? 'good' : 'warn'}>AI provider key {health.aiConfigured ? 'configured' : 'missing'}</Badge>
                  {health.model ? <Badge tone="blue">{health.model}</Badge> : null}
                </>
              )}
            </div>
          ) : null}
        </Card>

        <Card title="Your data">
          <p className="muted">Everything lives in this browser. Export regularly, especially before clearing site data.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => download('verdict-qa-workspace.json', JSON.stringify(state, null, 2), 'application/json')}>Export workspace (JSON)</button>
            <label style={{ flexDirection: 'row', alignItems: 'center' }}>Import<input type="file" accept=".json,application/json" onChange={(e) => importFile(e.target.files?.[0])} /></label>
            <button type="button" className="btn btn-danger" onClick={() => { if (window.confirm('Delete all rubrics, evaluations, issues and tests from this browser?')) { replace(emptyState()); setDataMsg({ tone: 'good', text: 'Workspace cleared.' }); } }}>Reset workspace</button>
          </div>
          {dataMsg ? <div style={{ marginTop: 10 }}><Notice tone={dataMsg.tone}>{dataMsg.text}</Notice></div> : null}
        </Card>

        <Card title="Server environment variables">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Variable</th><th>Purpose</th></tr></thead>
              <tbody>
                <tr><td><code>VERDICT_ACCESS_TOKEN</code></td><td>Required for /api/judge and /api/source. Without it both refuse every request.</td></tr>
                <tr><td><code>ANTHROPIC_API_KEY</code></td><td>Enables the three AI judges. Never exposed to the browser.</td></tr>
                <tr><td><code>VERDICT_JUDGE_MODEL</code></td><td>Optional model override. Defaults to claude-sonnet-5-5.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
