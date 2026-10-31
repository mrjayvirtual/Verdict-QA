import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Notice } from './ui';

const NAV: [string, string][] = [
  ['/', 'Overview'],
  ['/projects', 'Projects'],
  ['/rubrics', 'Rubric Intelligence'],
  ['/evaluate', 'New Evaluation'],
  ['/evaluations', 'Evaluations'],
  ['/tests', 'Test Cases'],
  ['/issues', 'Issues'],
  ['/analytics', 'Analytics'],
  ['/settings', 'Settings'],
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { saveError } = useStore();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="brand">
          <strong>
            VERDICT <span>QA</span>
          </strong>
          <small>Built by MRJAYVIRTUAL Technologies</small>
        </div>
        <button type="button" className="btn menu-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Menu
        </button>
        <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">Evidence in. Verdict out. Fix, then verify.</div>
      </aside>
      <main className="content">
        {saveError ? <Notice tone="bad">{saveError}</Notice> : null}
        <Outlet />
      </main>
    </div>
  );
}
