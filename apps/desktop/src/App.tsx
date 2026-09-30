import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { DashboardArea } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from './lib/supabase';

declare global {
  interface Window {
    tradeosWindow: { minimize: () => void; close: () => void };
  }
}

type AuthMode = 'sign-in' | 'sign-up';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [area, setArea] = useState<DashboardArea>('trading');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError('Add Supabase URL and publishable key to the app environment first.'); return; }
    setBusy(true); setError(''); setNote('');
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (mode === 'sign-up' && !result.data.session) setNote('Check your email to confirm your account, then sign in.');
  }

  return (
    <main className="window">
      <header className="titlebar"><div className="brand"><span className="brand-mark">T</span><span>TradeOS</span></div><div className="window-actions"><button aria-label="Minimize" onClick={() => window.tradeosWindow.minimize()}>−</button><button aria-label="Close" onClick={() => window.tradeosWindow.close()}>×</button></div></header>
      {session ? <section className="workspace">
        <div className="eyebrow">YOUR WORKSPACE</div>
        <h1>{area === 'trading' ? 'Trade with intention.' : 'Build a steady day.'}</h1>
        <p className="intro">A calm space to follow your own process and reflect.</p>
        <nav className="switcher" aria-label="Workspace area">{(['trading', 'personal'] as const).map((item) => <button key={item} className={area === item ? 'selected' : ''} onClick={() => setArea(item)}>{item === 'trading' ? 'Trading' : 'Personal'}</button>)}</nav>
        <article className="card"><div className="eyebrow">{area === 'trading' ? 'TRADING DESK' : 'PERSONAL SPACE'}</div><h2>{area === 'trading' ? 'Your rules. Your journal.' : 'Make space for the rest.'}</h2><p>{area === 'trading' ? 'Start with your strategy and a deliberate pre-trade pause.' : 'Daily focus and life-area check-ins will live here.'}</p><span className="ready"><i /> Workspace ready</span></article>
        <div className="account"><span>{session.user.email}</span><button className="text-button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div>
      </section> : <section className="auth">
        <div className="eyebrow">YOUR PRIVATE WORKSPACE</div><h1>Welcome to TradeOS.</h1><p className="intro">Sign in or create an account to sync across devices.</p>
        <form onSubmit={(event) => void authenticate(event)}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required /></label>
          {error && <p className="error" role="alert">{error}</p>}{note && <p className="note" role="status">{note}</p>}
          {!isSupabaseConfigured && <p className="hint">Supabase credentials are not configured yet.</p>}
          <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in  ↗' : 'Create account  ↗'}</button>
        </form>
        <button className="text-button auth-toggle" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setNote(''); }}>{mode === 'sign-in' ? 'Create an account' : 'Back to sign in'}</button>
      </section>}
      <footer>No broker passwords. No trade signals. Just your process.</footer>
    </main>
  );
}

