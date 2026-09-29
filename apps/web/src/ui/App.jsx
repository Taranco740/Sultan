import { useEffect, useMemo, useState } from 'react';
import { localDay } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const areas = [
  { id: 'personal', label: 'Personal', icon: '◌', color: 'pink' },
  { id: 'trading', label: 'Trading', icon: '↗', color: 'blue' },
  { id: 'health', label: 'Health', icon: '✳', color: 'green' },
  { id: 'work', label: 'Work & Wealth', icon: '⌘', color: 'violet' },
];

const seedTasks = [
  { id: 'a', title: 'Review today’s trading plan', area: 'trading', done: true, time: '08:15' },
  { id: 'b', title: 'Complete strength session', area: 'health', done: false, time: '12:30' },
  { id: 'c', title: 'Ship one meaningful project step', area: 'work', done: false, time: '15:00' },
];

function Icon({ children, className = '' }) { return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>; }
function dateLabel() { return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()); }

export default function App() {
  const [area, setArea] = useState('personal');
  const [tasks, setTasks] = useState(seedTasks);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capture, setCapture] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    let alive = true;
    supabase.from('focus_items').select('id,title,area,done,remind_at').eq('user_id', user.id).eq('day', localDay()).order('created_at')
      .then(({ data, error }) => {
        if (!alive || error) return;
        setTasks((data ?? []).map(item => ({ ...item, time: item.remind_at?.slice(0, 5) ?? '' })));
      });
    return () => { alive = false; };
  }, [user]);

  const completed = tasks.filter(task => task.done).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const missing = useMemo(() => areas.filter(item => item.id !== 'personal').find(item => !tasks.some(task => task.area === item.id && task.done)), [tasks]);

  async function saveTask(nextTasks) {
    setTasks(nextTasks);
    if (!supabase || !user) return;
    const changed = nextTasks.find(task => !tasks.some(old => old.id === task.id));
    if (changed) {
      await supabase.from('focus_items').insert({ title: changed.title, area: changed.area, day: localDay(), done: false, user_id: user.id });
    } else {
      const changedTask = nextTasks.find(task => tasks.some(old => old.id === task.id && old.done !== task.done));
      if (changedTask) await supabase.from('focus_items').update({ done: changedTask.done }).eq('id', changedTask.id).eq('user_id', user.id);
    }
  }

  async function signIn(event) {
    event.preventDefault(); setAuthMessage('');
    if (!supabase) { setAuthMessage('Connect Sultan to Supabase to enable your private account.'); return; }
    const action = authMode === 'signin' ? supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }) : supabase.auth.signUp({ email: authEmail, password: authPassword });
    const { error, data } = await action;
    if (error) setAuthMessage(error.message);
    else if (authMode === 'signup' && !data.session) setAuthMessage('Check your inbox to confirm your email, then sign in.');
    else setAuthOpen(false);
  }

  function addTask(event) {
    event.preventDefault();
    const title = capture.trim(); if (!title) return;
    const newTask = { id: crypto.randomUUID(), title, area: area === 'personal' ? 'work' : area, done: false, time: '' };
    saveTask([...tasks, newTask]); setCapture(''); setCaptureOpen(false);
  }

  const activeArea = areas.find(item => item.id === area);
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark">S</span><span>Sultan<small>PERSONAL OPERATING SYSTEM</small></span></a>
      <div className="side-caption">YOUR SPACE</div>
      <button className={`nav-item ${area === 'personal' ? 'selected' : ''}`} onClick={() => setArea('personal')}><Icon>⌂</Icon> Today <span className="nav-key">⌘ 1</span></button>
      <div className="side-caption spaced">AREAS</div>
      {areas.filter(item => item.id !== 'personal').map(item => <button key={item.id} className={`nav-item ${area === item.id ? 'selected' : ''}`} onClick={() => setArea(item.id)}><Icon className={item.color}>{item.icon}</Icon> {item.label}<span className="nav-dot" /></button>)}
      <div className="sidebar-bottom">
        <div className="week-card"><span className="week-spark">✦</span><b>Your week, in motion</b><p>Small steps are adding up.</p><div className="week-meter"><i style={{ width: `${Math.max(12, progress)}%` }} /></div><small>{progress}% of today done</small></div>
        <button className="profile" onClick={() => user ? supabase?.auth.signOut() : (setAuthMode('signin'), setAuthOpen(true))}><span className="avatar">{user?.email?.slice(0, 1).toUpperCase() ?? 'S'}</span><span><b>{user ? 'My account' : 'Sultan space'}</b><small>{user?.email ?? 'Sign in to sync'}</small></span><span className="profile-more">···</span></button>
      </div>
    </aside>

    <main className="main" id="top">
      <header className="topbar"><div className="crumb">My space <span>/</span> {area === 'personal' ? 'Today' : activeArea.label}</div><div className="top-actions"><span className="sync-state"><i /> {isSupabaseConfigured && user ? 'Synced' : 'Preview mode'}</span><button className="icon-button" aria-label="Quick capture" onClick={() => setCaptureOpen(true)}>＋</button><button className="top-avatar" onClick={() => (setAuthMode('signin'), setAuthOpen(true))}>{user?.email?.slice(0, 1).toUpperCase() ?? 'S'}</button></div></header>

      <section className="welcome rise"><div><div className="eyebrow">{dateLabel().toUpperCase()} <span className="eyebrow-line" /></div><h1>{area === 'personal' ? <>Make today<br/><em>count.</em></> : <>{activeArea.label}<br/><em>in rhythm.</em></>}</h1><p className="welcome-sub">A clear head. A few meaningful moves. Then let the day unfold.</p></div><div className="orbit-card"><div className="orbit-glow"/><div className="orbit-label">TODAY'S RHYTHM</div><div className="orbit-ring" style={{'--progress': `${progress * 3.6}deg`}}><div><strong>{progress}</strong><span>%</span></div></div><div className="orbit-foot">{completed} of {tasks.length} steps complete</div></div></section>

      <section className="area-strip rise delay-1">{areas.map(item => <button key={item.id} onClick={() => setArea(item.id)} className={`area-pill ${area === item.id ? 'active' : ''}`}><span className={`pill-icon ${item.color}`}>{item.icon}</span>{item.label}<span className="pill-arrow">↗</span></button>)}</section>

      <div className="dashboard-grid rise delay-2">
        <section className="focus-panel panel"><div className="panel-head"><div><div className="eyebrow small">YOUR DAILY FOCUS</div><h2>Keep it simple.</h2></div><button className="text-button" onClick={() => setCaptureOpen(true)}>＋ Add a step</button></div><p className="panel-desc">Three good moves can change the shape of a day.</p><div className="task-list">{tasks.map((task, index) => <label className={`task-row ${task.done ? 'is-done' : ''}`} key={task.id} style={{'--i': index}}><button className="check" aria-label={task.done ? 'Mark incomplete' : 'Complete step'} onClick={() => saveTask(tasks.map(item => item.id === task.id ? { ...item, done: !item.done } : item))}>{task.done && <span>✓</span>}</button><span className="task-copy"><b>{task.title}</b><small>{areas.find(item => item.id === task.area)?.label ?? 'Personal'}{task.time && ` · ${task.time}`}</small></span><span className={`task-area ${task.area}`}>{areas.find(item => item.id === task.area)?.icon ?? '◌'}</span></label>)}</div><button className="minimum-day" onClick={() => { if (tasks.length === 0) saveTask([{ id: crypto.randomUUID(), title: 'Take one small step', area: 'personal', done: true }]); else saveTask(tasks.map((item, index) => ({ ...item, done: index === 0 ? true : item.done }))); }}>✦ <span><b>Minimum day</b><small>Make one small promise and keep it.</small></span><span className="min-arrow">↗</span></button></section>

        <section className="insight-panel panel"><div className="panel-head"><div><div className="eyebrow small">A GENTLE NUDGE</div><h2>Notice the gap.</h2></div><span className="insight-star">✳</span></div><p className="panel-desc">Progress is easier when you can see what needs a little care.</p><div className="gap-card"><div className="gap-top"><span className="gap-icon">{missing?.icon ?? '✦'}</span><span className="gap-label">COULD USE YOUR ATTENTION</span></div><h3>{missing ? `Make room for ${missing.label.toLowerCase()}` : 'You’re building a steady rhythm'}</h3><p>{missing ? 'No completed step here yet today. Choose one small action and let that be enough.' : 'You have checked in across the areas that matter today.'}</p><button onClick={() => setArea(missing?.id ?? 'personal')}>Choose a next step <span>↗</span></button></div><div className="quote-row"><span>“</span><p>Consistency is a form of self-respect.</p></div></section>
      </div>
      <footer className="footer"><span>Built for the life you’re creating.</span><span>Quiet progress, every day <i>✦</i></span></footer>
    </main>

    <nav className="mobile-nav">{areas.map(item => <button key={item.id} className={area === item.id ? 'active' : ''} onClick={() => setArea(item.id)}><span>{item.icon}</span>{item.label.split(' ')[0]}</button>)}</nav>

    {captureOpen && <div className="veil" onMouseDown={event => event.target === event.currentTarget && setCaptureOpen(false)}><form className="dialog" onSubmit={addTask}><button type="button" className="dialog-close" onClick={() => setCaptureOpen(false)}>×</button><div className="eyebrow small">QUICK CAPTURE</div><h2>What’s on your mind?</h2><p>Catch the thought. Decide what it means later.</p><input autoFocus value={capture} onChange={e => setCapture(e.target.value)} placeholder="A small step, thought or reminder…"/><div className="dialog-actions"><button type="button" className="ghost-button" onClick={() => setCaptureOpen(false)}>Cancel</button><button type="submit" className="primary-button">Save this step <span>↗</span></button></div></form></div>}

    {authOpen && <div className="veil" onMouseDown={event => event.target === event.currentTarget && setAuthOpen(false)}><form className="dialog auth-dialog" onSubmit={signIn}><button type="button" className="dialog-close" onClick={() => setAuthOpen(false)}>×</button><div className="brand-mark dialog-mark">S</div><div className="eyebrow small">YOUR PRIVATE SPACE</div><h2>{authMode === 'signin' ? 'Welcome back.' : 'Begin with Sultan.'}</h2><p>Your same secure account will connect Sultan across web and Android.</p><input type="email" required autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email address"/><input type="password" required minLength={8} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password"/>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button auth-submit" type="submit">{authMode === 'signin' ? 'Sign in' : 'Create account'} <span>↗</span></button><button type="button" className="switch-auth" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage(''); }}>{authMode === 'signin' ? 'New here? Create your account' : 'Already have an account? Sign in'}</button></form></div>}
  </div>;
}
