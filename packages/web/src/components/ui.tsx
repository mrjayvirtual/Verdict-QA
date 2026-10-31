import { useState, type ReactNode } from 'react';
import type { CriterionStatus, Verdict } from '../lib/types';

type Tone = 'neutral' | 'blue' | 'violet' | 'gold' | 'good' | 'warn' | 'bad';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const VERDICT_TONE: Record<Verdict, Tone> = {
  PASS: 'good',
  'CONDITIONAL PASS': 'gold',
  'NEEDS REVIEW': 'warn',
  FAIL: 'bad',
};

export function VerdictBadge({ v }: { v: Verdict }) {
  return <Badge tone={VERDICT_TONE[v]}>{v}</Badge>;
}

const STATUS_TONE: Record<CriterionStatus, Tone> = {
  pass: 'good',
  partial: 'gold',
  fail: 'bad',
  'needs-review': 'warn',
};

export function StatusBadge({ s }: { s: CriterionStatus }) {
  return <Badge tone={STATUS_TONE[s]}>{s}</Badge>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="muted">{sub}</p> : null}
      </div>
      {actions ? <div className="row no-print">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title || actions ? (
        <div className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="row no-print">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint ? <p className="muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export function Notice({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function ScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">Manual check</span>;
  const tone = value >= 70 ? 'good' : value >= 35 ? 'gold' : 'bad';
  return (
    <div className="scorebar" title={`${value}/100`}>
      <div className={`scorebar-fill fill-${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      <span>{value}</span>
    </div>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'ok' : 'fail');
        setTimeout(() => setState('idle'), 1800);
      }}
    >
      {state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy failed' : label}
    </button>
  );
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
