import { useEffect, useState } from 'react';
import { localTradingDay } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [checklists, setChecklists] = useState([]);
  const [checklistId, setChecklistId] = useState('');
  const [items, setItems] = useState([]);
  const [checks, setChecks] = useState({});
  const [accountLabel, setAccountLabel] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [accountMode, setAccountMode] = useState('demo');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [newItem, setNewItem] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) { setAccounts([]); setAccountId(''); return; }
    let active = true;
    void supabase.from('trading_accounts').select('*').eq('user_id', user.id).order('created_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setMessage(error.message); return; }
        const rows = data ?? [];
        setAccounts(rows);
        setAccountId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!supabase || !user || !accountId) { setChecklists([]); setChecklistId(''); return; }
    let active = true;
    void supabase.from('trading_checklists').select('*').eq('user_id', user.id).eq('account_id', accountId).order('created_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setMessage(error.message); return; }
        const rows = data ?? [];
        setChecklists(rows);
        setChecklistId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
      });
    return () => { active = false; };
  }, [user, accountId]);

  useEffect(() => {
    if (!supabase || !user || !checklistId) { setItems([]); setChecks({}); return; }
    let active = true;
    void (async () => {
      const { data: rows, error } = await supabase.from('trading_checklist_items').select('*').eq('user_id', user.id).eq('checklist_id', checklistId).order('position');
      if (!active) return;
      if (error) { setMessage(error.message); return; }
      const list = rows ?? [];
      setItems(list);
      if (list.length === 0) { setChecks({}); return; }
      const { data: doneRows, error: checksError } = await supabase.from('trading_checklist_checks').select('item_id,checked').eq('user_id', user.id).eq('trading_day', localTradingDay()).in('item_id', list.map((item) => item.id));
      if (!active) return;
      if (checksError) { setMessage(checksError.message); return; }
      setChecks(Object.fromEntries((doneRows ?? []).map((row) => [row.item_id, row.checked])));
    })();
    return () => { active = false; };
  }, [user, checklistId]);

  async function authenticate(event) {
    event.preventDefault(); setMessage('');
    if (!supabase) { setMessage('Add the Supabase URL and publishable key to enable sign in.'); return; }
    const result = authMode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) setMessage(result.error.message);
    else if (authMode === 'signup' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
  }

  async function addAccount(event) {
    event.preventDefault(); setMessage('');
    if (!supabase || !user) return;
    const { data, error } = await supabase.from('trading_accounts').insert({ label: accountLabel.trim(), broker_name: brokerName.trim() || null, mode: accountMode, user_id: user.id }).select().single();
    if (error) { setMessage(error.message); return; }
    setAccounts((rows) => [...rows, data]); setAccountId(data.id); setAccountLabel(''); setBrokerName(''); setAccountMode('demo'); setShowAccountForm(false);
  }

  async function addChecklist(event) {
    event.preventDefault(); setMessage('');
    if (!supabase || !user || !accountId) return;
    const { data, error } = await supabase.from('trading_checklists').insert({ title: checklistTitle.trim(), account_id: accountId, user_id: user.id }).select().single();
    if (error) { setMessage(error.message); return; }
    setChecklists((rows) => [...rows, data]); setChecklistId(data.id); setChecklistTitle('');
  }

  async function addChecklistItem(event) {
    event.preventDefault(); setMessage('');
    if (!supabase || !user || !checklistId || !newItem.trim()) return;
    const { data, error } = await supabase.from('trading_checklist_items').insert({ label: newItem.trim(), checklist_id: checklistId, user_id: user.id, position: items.length }).select().single();
    if (error) { setMessage(error.message); return; }
    setItems((rows) => [...rows, data]); setNewItem('');
  }

  async function toggleItem(item) {
    if (!supabase || !user) return;
    const checked = !checks[item.id];
    setChecks((rows) => ({ ...rows, [item.id]: checked }));
    const { error } = await supabase.from('trading_checklist_checks').upsert({ user_id: user.id, item_id: item.id, trading_day: localTradingDay(), checked, updated_at: new Date().toISOString() }, { onConflict: 'item_id,trading_day' });
    if (error) { setChecks((rows) => ({ ...rows, [item.id]: !checked })); setMessage(error.message); }
  }

  async function deleteItem(item) {
    if (!supabase || !user) return;
    const { error } = await supabase.from('trading_checklist_items').delete().eq('id', item.id).eq('user_id', user.id);
    if (error) { setMessage(error.message); return; }
    setItems((rows) => rows.filter((row) => row.id !== item.id));
    setChecks((rows) => { const next = { ...rows }; delete next[item.id]; return next; });
  }

  const complete = items.length > 0 && items.every((item) => checks[item.id]);

  if (!user) return <div className="trade-shell auth-shell"><section className="auth-card">
    <div className="brand-line"><span className="brand-mark">T</span><span>TradeOS<small>YOUR TRADING DESK</small></span></div>
    <div className="eyebrow">TRADE WITH YOUR OWN RULES</div><h1>One trade at a time.</h1><p className="muted">Sign in to keep your accounts and daily checklist in sync across devices.</p>
    <form className="stack" onSubmit={authenticate}><input required type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} /><input required minLength={8} type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />{message && <p className="notice">{message}</p>}{!isSupabaseConfigured && <p className="notice">Supabase settings are not configured.</p>}<button className="primary" type="submit">{authMode === 'signin' ? 'Sign in' : 'Create account'} <span>↗</span></button></form>
    <button className="quiet-button full" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>{authMode === 'signin' ? 'Create an account' : 'Back to sign in'}</button>
  </section></div>;

  return <div className="trade-shell">
    <header className="trade-topbar"><div className="brand-line"><span className="brand-mark">T</span><span>TradeOS<small>TRADING DESK</small></span></div><div className="account-tools"><span className="user-email">{user.email}</span><button className="quiet-button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div></header>
    <main className="trade-content"><div className="eyebrow">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</div><section className="page-heading"><div><h1>Trade with intention.</h1><p className="muted">Your accounts, your rules, your daily pre-trade routine.</p></div><span className="live-indicator"><i /> PRIVATE WORKSPACE</span></section>
      <section className="control-row"><label className="field-label">TRADING ACCOUNT<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose an account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label} · {account.mode.toUpperCase()}</option>)}</select></label><button className="secondary" onClick={() => setShowAccountForm((value) => !value)}>＋ Add account</button></section>
      {showAccountForm && <form className="inline-form account-form" onSubmit={addAccount}><input required maxLength={50} placeholder="Account label (e.g. Demo 1)" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} /><input maxLength={60} placeholder="Broker name (optional)" value={brokerName} onChange={(event) => setBrokerName(event.target.value)} /><select value={accountMode} onChange={(event) => setAccountMode(event.target.value)}><option value="demo">Demo</option><option value="live">Live</option><option value="paper">Paper</option></select><button className="primary compact">Save account</button></form>}
      {!accounts.length && <section className="empty-card"><div className="empty-icon">＋</div><h2>Add your first trading account</h2><p className="muted">Create a profile for your Demo, Live, or Paper account. TradeOS stores a label and records only; never enter broker passwords.</p><button className="primary" onClick={() => setShowAccountForm(true)}>Add trading account</button></section>}
      {!!accountId && <div className="desk-grid"><section className="checklist-card">
        <div className="card-header"><div><div className="eyebrow">PRE-TRADE ROUTINE</div><h2>Checklist for the day</h2></div><span className="date-chip">{localTradingDay()}</span></div>
        <div className="list-tools"><label className="field-label">CHECKLIST<select value={checklistId} onChange={(event) => setChecklistId(event.target.value)}><option value="">Choose a checklist</option>{checklists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label><form className="inline-create" onSubmit={addChecklist}><input required maxLength={70} placeholder="New checklist name" value={checklistTitle} onChange={(event) => setChecklistTitle(event.target.value)} /><button className="secondary compact">＋ Create</button></form></div>
        {!!checklistId && <><div className="progress-row"><span>{Object.values(checks).filter(Boolean).length} of {items.length} complete</span><span>{complete ? 'READY' : 'LOG TRADE LOCKED'}</span></div><div className="progress-track"><i style={{ width: `${items.length ? Object.values(checks).filter(Boolean).length / items.length * 100 : 0}%` }} /></div>
          <div className="checklist-items">{items.map((item) => <div className={`check-item ${checks[item.id] ? 'checked' : ''}`} key={item.id}><button className="check-toggle" aria-label={checks[item.id] ? `Uncheck ${item.label}` : `Check ${item.label}`} onClick={() => void toggleItem(item)}>{checks[item.id] ? '✓' : ''}</button><span>{item.label}</span><button className="delete-item" aria-label={`Delete ${item.label}`} onClick={() => void deleteItem(item)}>×</button></div>)}{!items.length && <p className="empty-hint">Add your own trading rules below. Only your items appear here.</p>}</div>
          <form className="add-item-form" onSubmit={addChecklistItem}><input required maxLength={120} placeholder="Add a checklist item…" value={newItem} onChange={(event) => setNewItem(event.target.value)} /><button className="secondary">Add item</button></form>
          <button className="log-trade" disabled={!complete} onClick={() => setMessage('Your checklist is complete. Journaling is the next module to add.')}>Log trade <span>{complete ? '↗' : 'Complete every item first'}</span></button>
        </>}
        {!checklists.length && <p className="empty-hint">Create a checklist for this account, then add the rules you want to follow each day.</p>}
      </section><aside className="side-note"><div className="eyebrow">YOUR TRADING SPACE</div><h2>Built around your process.</h2><p>Use separate account profiles to keep Demo, Live, and Paper journals organized under this one login.</p><div className="feature-line"><span>01</span><b>Choose your account</b></div><div className="feature-line"><span>02</span><b>Build your checklist</b></div><div className="feature-line"><span>03</span><b>Check each rule before a trade</b></div></aside></div>}
      {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}
    </main>
  </div>;
}

