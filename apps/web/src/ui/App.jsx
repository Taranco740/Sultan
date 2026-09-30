import { useEffect, useMemo, useState } from 'react';
import { getDailyOutcomes, getTradeInsights, localTradingDay, monthCalendarDays } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const emptyTrade = { symbol: '', side: 'buy', setup: '', reason: '', emotion: '', lesson: '', followed_plan: true, outcome: 'pending' };
const monthLabel = (date) => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
const navItems = [
  { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { id: 'journal', icon: '✎', label: 'Journal' },
  { id: 'accounts', icon: '▣', label: 'Accounts' },
  { id: 'calendar', icon: '▦', label: 'Calendar' },
  { id: 'reports', icon: '⌁', label: 'Reports' },
];

function OutcomeChart({ rows, compact = false }) {
  if (!rows.length) return <div className="chart-empty">Your trade outcomes will build a trend here.</div>;
  const width = 760;
  const height = compact ? 112 : 250;
  const pad = compact ? 10 : 18;
  const values = rows.reduce((series, row) => [...series, (series.at(-1) ?? 0) + row.net], [0]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = pad + index * ((width - pad * 2) / Math.max(1, values.length - 1));
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  const fill = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  return <div className={`outcome-chart ${compact ? 'compact' : ''}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative wins minus losses by trading day">
      <defs><linearGradient id="outcome-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--blue)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--blue)" stopOpacity=".02" /></linearGradient></defs>
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="chart-axis" />
      <polygon points={fill} fill="url(#outcome-fill)" />
      <polyline points={line} fill="none" className="chart-line" />
      {points.map(([x, y], index) => <circle key={`${x}-${index}`} cx={x} cy={y} r="3.5" className="chart-point"><title>{rows[index - 1]?.day ?? rows[0]?.day}: net {values[index]}</title></circle>)}
    </svg>
    <div className="chart-labels"><span>{rows[0].day}</span><span>{rows.at(-1).day}</span></div>
  </div>;
}

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
  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [tradeForm, setTradeForm] = useState(emptyTrade);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(localTradingDay());
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [accountMode, setAccountMode] = useState('demo');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [newItem, setNewItem] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function focusSearch(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('trade-search')?.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  useEffect(() => {
    if (!supabase || !user) { setAccounts([]); setAccountId(''); return undefined; }
    let active = true;
    void supabase.from('trading_accounts').select('*').eq('user_id', user.id).order('created_at').then(({ data, error }) => {
      if (!active) return;
      if (error) { setMessage(error.message); return; }
      const rows = data ?? [];
      setAccounts(rows);
      setAccountId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!supabase || !user || !accountId) { setChecklists([]); setChecklistId(''); setTrades([]); return undefined; }
    let active = true;
    void Promise.all([
      supabase.from('trading_checklists').select('*').eq('user_id', user.id).eq('account_id', accountId).order('created_at'),
      supabase.from('trading_journal_entries').select('*').eq('user_id', user.id).eq('account_id', accountId).order('trading_day', { ascending: false }).order('created_at', { ascending: false }),
    ]).then(([listsResult, tradesResult]) => {
      if (!active) return;
      if (listsResult.error) setMessage(listsResult.error.message);
      if (tradesResult.error) setMessage(tradesResult.error.message);
      const rows = listsResult.data ?? [];
      setChecklists(rows);
      setChecklistId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
      setTrades(tradesResult.data ?? []);
    });
    return () => { active = false; };
  }, [user, accountId]);

  useEffect(() => {
    if (!supabase || !user || !checklistId) { setItems([]); setChecks({}); return undefined; }
    let active = true;
    void (async () => {
      const { data: rows, error } = await supabase.from('trading_checklist_items').select('*').eq('user_id', user.id).eq('checklist_id', checklistId).order('position');
      if (!active) return;
      if (error) { setMessage(error.message); return; }
      const list = rows ?? [];
      setItems(list);
      if (!list.length) { setChecks({}); return; }
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
    setBusy(true);
    const result = authMode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
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
    const checked = !checks[item.id]; setChecks((rows) => ({ ...rows, [item.id]: checked }));
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
  async function logTrade(event) {
    event.preventDefault(); setMessage('');
    if (!supabase || !user || !accountId || !complete) { setMessage('Complete every checklist item before logging this trade.'); return; }
    setBusy(true);
    const payload = { ...tradeForm, symbol: tradeForm.symbol.trim().toUpperCase(), setup: tradeForm.setup.trim(), reason: tradeForm.reason.trim(), emotion: tradeForm.emotion.trim(), lesson: tradeForm.lesson.trim(), outcome: tradeForm.outcome || null, trading_day: localTradingDay(), account_id: accountId, user_id: user.id };
    const { data, error } = await supabase.from('trading_journal_entries').insert(payload).select().single();
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setTrades((rows) => [data, ...rows]); setSelectedDay(data.trading_day); setTradeForm(emptyTrade); setTab('journal'); setMessage('Trade saved to your journal.');
  }

  const calendarDays = useMemo(() => monthCalendarDays(month), [month]);
  const tradedDays = useMemo(() => new Set(trades.map((trade) => trade.trading_day)), [trades]);
  const selectedTrades = trades.filter((trade) => trade.trading_day === selectedDay);
  const filteredTrades = useMemo(() => {
    const cutoff = period === 'all' ? null : new Date(Date.now() - Number(period) * 86400000).toISOString().slice(0, 10);
    return trades.filter((trade) => (!cutoff || trade.trading_day >= cutoff) && (!search || `${trade.symbol} ${trade.setup} ${trade.reason} ${trade.emotion}`.toLowerCase().includes(search.toLowerCase())));
  }, [trades, period, search]);
  const insights = useMemo(() => getTradeInsights(filteredTrades), [filteredTrades]);
  const outcomeRows = useMemo(() => getDailyOutcomes(filteredTrades), [filteredTrades]);
  const account = accounts.find((row) => row.id === accountId);
  const checkedCount = Object.values(checks).filter(Boolean).length;

  if (!user) return <div className="trade-shell auth-shell"><section className="auth-card">
    <div className="brand-line"><span className="brand-mark">S</span><span>Sultan<small>TRADING WORKSPACE</small></span></div>
    <div className="eyebrow">TRADE WITH YOUR OWN RULES</div><h1>One trade at a time.</h1><p className="muted">Sign in to sync your accounts and daily checklist across devices.</p>
    <form className="stack" onSubmit={authenticate}><input required type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} /><input required minLength={8} type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />{message && <p className="notice">{message}</p>}{!isSupabaseConfigured && <p className="notice">Supabase settings are not configured.</p>}<button className="primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'} <span>↗</span></button></form>
    <button className="quiet-button full" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>{authMode === 'signin' ? 'Create an account' : 'Back to sign in'}</button>
  </section></div>;

  const checklistPanel = <section className="panel checklist-card">
    <div className="card-header"><div><div className="eyebrow">PRE-TRADE ROUTINE</div><h2>Checklist for the day</h2></div><span className="date-chip">{localTradingDay()}</span></div>
    <div className="list-tools"><label className="field-label">CHECKLIST<select value={checklistId} onChange={(event) => setChecklistId(event.target.value)}><option value="">Choose a checklist</option>{checklists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label><form className="inline-create" onSubmit={addChecklist}><input required maxLength={70} placeholder="New checklist name" value={checklistTitle} onChange={(event) => setChecklistTitle(event.target.value)} /><button className="secondary compact">＋ Create</button></form></div>
    {!!checklistId && <><div className="progress-row"><span>{checkedCount} of {items.length} complete</span><span>{complete ? 'READY TO LOG' : 'LOG TRADE LOCKED'}</span></div><div className="progress-track"><i style={{ width: `${items.length ? checkedCount / items.length * 100 : 0}%` }} /></div>
      <div className="checklist-items">{items.map((item) => <div className={`check-item ${checks[item.id] ? 'checked' : ''}`} key={item.id}><button className="check-toggle" aria-label={checks[item.id] ? `Uncheck ${item.label}` : `Check ${item.label}`} onClick={() => void toggleItem(item)}>{checks[item.id] ? '✓' : ''}</button><span>{item.label}</span><button className="delete-item" aria-label={`Delete ${item.label}`} onClick={() => void deleteItem(item)}>×</button></div>)}{!items.length && <p className="empty-hint">Add the rules you want to follow before each trade.</p>}</div>
      <form className="add-item-form" onSubmit={addChecklistItem}><input required maxLength={120} placeholder="Add a checklist item…" value={newItem} onChange={(event) => setNewItem(event.target.value)} /><button className="secondary">Add item</button></form>
      <button className="log-trade" disabled={!complete} onClick={() => complete && setTab('journal')}>Log trade <span>{complete ? 'Open journal ↗' : 'Complete every item first'}</span></button>
    </>}
    {!checklists.length && <p className="empty-hint">Create a checklist for this account, then add your trading rules.</p>}
  </section>;

  return <div className="trade-shell app-shell">
    <aside className="primary-rail"><div className="rail-brand"><span className="brand-mark">S</span></div><nav aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></button>)}</nav><button className="rail-profile" aria-label="Sign out" onClick={() => void supabase?.auth.signOut()}>{user.email?.slice(0, 1).toUpperCase() ?? 'S'}</button></aside>
    <aside className="secondary-sidebar"><div className="brand-line"><span>Sultan<small>TRADING WORKSPACE</small></span></div><div className="sidebar-group"><div className="sidebar-label">WORKSPACE</div>{[['dashboard', 'Metrics'], ['calendar', 'Calendar'], ['reports', 'How you traded']].map(([id, label]) => <button key={id} className={`side-link ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}><i />{label}</button>)}</div><div className="sidebar-group"><div className="sidebar-label">TRADING ROUTINE</div><button className={`side-link ${tab === 'routine' ? 'active' : ''}`} onClick={() => setTab('routine')}><i />Checklist for the day</button><button className={`side-link ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}><i />Journal</button></div><div className="sidebar-account"><span className="account-dot" />{account?.label ?? 'Choose an account'}<small>{account?.mode?.toUpperCase() ?? 'NO ACCOUNT'}</small></div><button className="sidebar-settings" onClick={() => setTab('accounts')}>⚙ Account settings</button></aside>
    <section className="app-main">
      <header className="app-topbar"><label className="search-field"><span>⌕</span><input id="trade-search" aria-label="Search trades" placeholder="Search your journal…" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>Ctrl K</kbd></label><div className="topbar-tools"><span className="sync-status"><i /> Private</span><select aria-label="Trading account" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose account</option>{accounts.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.mode.toUpperCase()}</option>)}</select><button className="user-chip" title={user.email} onClick={() => void supabase?.auth.signOut()}>{user.email?.slice(0, 1).toUpperCase() ?? 'S'}</button></div></header>
      <main className="trade-content">
        <div className="workspace-heading"><div><div className="eyebrow">{account?.mode?.toUpperCase() ?? 'PRIVATE'} · PERSONAL WORKSPACE</div><h1>{account?.label ?? 'Your trading desk'} <span className="heading-chevron">⌄</span></h1><p className="muted">Review your process, then make the next decision yourself.</p></div><div className="heading-actions"><label className="period-select">DATE RANGE<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All time</option><option value="90">Last 90 days</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option></select></label><button className="primary" onClick={() => setTab('accounts')}>＋ Add account</button></div></div>
        {tab !== 'accounts' && !accountId && <section className="workspace-banner"><div><strong>Set up your trading account</strong><span>Keep your journals and routines organized under this login.</span></div><button className="primary" onClick={() => { setTab('accounts'); setShowAccountForm(true); }}>Create trading account ↗</button></section>}

        {tab === 'dashboard' && <>
          <section className="workspace-banner"><div><strong>Trade by your own rules</strong><span>Trade count and outcome metrics are based on journal entries for this account.</span></div><button className="secondary" onClick={() => setTab('routine')}>Open daily checklist →</button></section>
          <div className="metric-grid"><article className="metric-card lead-metric"><div className="metric-top"><span>WIN RATE</span><span className="metric-icon">◒</span></div><strong>{insights.winRate.toFixed(1)}<small>%</small></strong><span className="metric-foot">{insights.wins} wins from {insights.closed} closed trades</span><div className="mini-progress"><i style={{ width: `${insights.winRate}%` }} /></div></article><article className="metric-card"><div className="metric-top"><span>TRADE COUNT</span><span className="metric-icon">▤</span></div><strong>{insights.total}</strong><span className="metric-foot">{insights.tradedDays} days with a journal entry</span><div className="mini-bars">{outcomeRows.slice(-20).map((row, index) => <i key={row.day} style={{ height: `${Math.max(18, Math.min(100, row.trades * 20))}%`, animationDelay: `${index * 18}ms` }} />)}</div></article><article className="metric-card"><div className="metric-top"><span>PLAN FOLLOWING</span><span className="metric-icon">✓</span></div><strong>{insights.planFollowingRate.toFixed(1)}<small>%</small></strong><span className="metric-foot">{insights.planFollowingCount} entries marked followed</span><div className="mini-progress"><i style={{ width: `${insights.planFollowingRate}%` }} /></div></article><article className="metric-card"><div className="metric-top"><span>CURRENT WIN STREAK</span><span className="metric-icon">♨</span></div><strong>{insights.currentWinStreak}<small> trades</small></strong><span className="metric-foot">Consecutive latest wins</span><div className="streak-flame">♨</div></article></div>
          <div className="dashboard-grid"><section className="panel balance-panel"><div className="panel-heading"><div><span className="eyebrow">PERFORMANCE</span><h2>Outcome trend</h2><p>Wins minus losses across your latest trading days</p></div><span className="chart-key"><i /> Net outcomes</span></div><OutcomeChart rows={outcomeRows} /></section><section className="panel focus-panel"><div className="panel-heading"><div><span className="eyebrow">DAILY ROUTINE</span><h2>Checklist progress</h2></div><button className="text-link" onClick={() => setTab('routine')}>Open →</button></div><div className="focus-number">{checkedCount}<span> / {items.length} complete today</span></div><div className="progress-track"><i style={{ width: `${items.length ? checkedCount / items.length * 100 : 0}%` }} /></div><p>{complete ? 'Your checklist is complete. You can log a journal entry.' : 'Complete every item before the journal unlocks.'}</p>{items.slice(0, 4).map((item) => <button className={`focus-item ${checks[item.id] ? 'done' : ''}`} key={item.id} onClick={() => void toggleItem(item)}><span>{checks[item.id] ? '✓' : ''}</span>{item.label}</button>)}</section></div>
          <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest journal entries</h2></div><button className="text-link" onClick={() => setTab('journal')}>View journal →</button></div><TradeTable trades={filteredTrades.slice(0, 5)} /></section>
        </>}

        {tab === 'routine' && <div className="content-grid">{checklistPanel}<aside className="panel helper-panel"><span className="eyebrow">YOUR TRADING PROCESS</span><h2>Keep the checklist close.</h2><p>Use the same account and checklist before you write a trade entry. Your journal stays private to your account.</p><button className="secondary" onClick={() => setTab('journal')}>Go to journal →</button><div className="rule-note">Logging is locked until every item is checked.</div></aside></div>}

        {tab === 'journal' && <div className="journal-layout"><section className="panel journal-compose"><div className="panel-heading"><div><span className="eyebrow">TRADE JOURNAL</span><h2>How you traded</h2></div><span className="date-chip">{localTradingDay()}</span></div>{!complete && <p className="gate-note">Finish today’s checklist before logging a trade. <button onClick={() => setTab('routine')}>Open checklist ↗</button></p>}<form className="journal-form" onSubmit={logTrade}><div className="journal-fields"><label>Symbol<input required maxLength={24} placeholder="e.g. EURUSD" value={tradeForm.symbol} onChange={(event) => setTradeForm({ ...tradeForm, symbol: event.target.value })} /></label><label>Side<select value={tradeForm.side} onChange={(event) => setTradeForm({ ...tradeForm, side: event.target.value })}><option value="buy">Buy</option><option value="sell">Sell</option></select></label><label>Setup<input required maxLength={120} placeholder="Your setup name" value={tradeForm.setup} onChange={(event) => setTradeForm({ ...tradeForm, setup: event.target.value })} /></label><label>Outcome<select value={tradeForm.outcome} onChange={(event) => setTradeForm({ ...tradeForm, outcome: event.target.value })}><option value="pending">Pending</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></label></div><label>Reason for the trade<textarea required maxLength={1000} rows={3} placeholder="What made this trade fit your plan?" value={tradeForm.reason} onChange={(event) => setTradeForm({ ...tradeForm, reason: event.target.value })} /></label><div className="journal-fields"><label>Emotion<input required maxLength={80} placeholder="How did you feel?" value={tradeForm.emotion} onChange={(event) => setTradeForm({ ...tradeForm, emotion: event.target.value })} /></label><label>Did you follow your plan?<select value={String(tradeForm.followed_plan)} onChange={(event) => setTradeForm({ ...tradeForm, followed_plan: event.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></label></div><label>Lesson<textarea required maxLength={1000} rows={3} placeholder="What will you remember next time?" value={tradeForm.lesson} onChange={(event) => setTradeForm({ ...tradeForm, lesson: event.target.value })} /></label><button className="primary journal-submit" disabled={!complete || busy || !accountId}>{busy ? 'Saving…' : 'Save journal entry ↗'}</button></form></section><section className="panel recent-trades"><div className="eyebrow">RECENT TRADES</div><h2>Your journal</h2><TradeTable trades={filteredTrades} detailed />{!trades.length && <p className="empty-hint">Saved trade notes will appear here.</p>}</section></div>}

        {tab === 'accounts' && <section className="accounts-page"><div className="accounts-intro"><div><span className="eyebrow">ACCOUNT ORGANIZATION</span><h2>Your trading accounts</h2><p className="muted">Create a separate workspace for each Demo, Live, or Paper account. Sultan stores labels and journal records only.</p></div><button className="primary" onClick={() => setShowAccountForm((value) => !value)}>＋ Add account</button></div>{showAccountForm && <form className="inline-form account-form panel" onSubmit={addAccount}><input required maxLength={50} placeholder="Account label (e.g. Demo 1)" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} /><input maxLength={60} placeholder="Broker name (optional)" value={brokerName} onChange={(event) => setBrokerName(event.target.value)} /><select value={accountMode} onChange={(event) => setAccountMode(event.target.value)}><option value="demo">Demo</option><option value="live">Live</option><option value="paper">Paper</option></select><button className="primary compact">Save account</button></form>}<div className="account-grid">{accounts.map((row) => <article className={`panel account-card ${row.id === accountId ? 'current' : ''}`} key={row.id}><div className="account-card-top"><span className="account-avatar">{row.label.slice(0, 1).toUpperCase()}</span><span className="account-mode-pill">{row.mode.toUpperCase()}</span></div><h3>{row.label}</h3><p>{row.broker_name || 'Personal trading account'}</p><div className="account-card-meta"><span>{row.id === accountId ? 'Currently active' : 'Use the account selector above'}</span><button className="secondary compact" onClick={() => { setAccountId(row.id); setTab('dashboard'); }}>{row.id === accountId ? 'Selected' : 'Open account'}</button></div></article>)}{!accounts.length && <div className="panel empty-state"><h3>Your first account starts here</h3><p>Create an account label to separate your trading records. No broker login details are requested.</p><button className="primary" onClick={() => setShowAccountForm(true)}>Add trading account</button></div>}</div></section>}

        {tab === 'calendar' && <section className="panel calendar-card"><div className="calendar-head"><div><span className="eyebrow">TRADING HISTORY</span><h2>Days you traded</h2><p>Pick a day to review its journal entries.</p></div><div className="month-controls"><button aria-label="Previous month" onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>‹</button><strong>{monthLabel(month)}</strong><button aria-label="Next month" onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>›</button></div></div><div className="calendar-grid calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map((day) => <button key={day} aria-label={`${day}${tradedDays.has(day) ? ', traded' : ''}`} className={`calendar-day ${day.slice(0, 7) === localTradingDay(month).slice(0, 7) ? '' : 'outside'} ${tradedDays.has(day) ? 'traded' : ''} ${selectedDay === day ? 'selected' : ''}`} onClick={() => setSelectedDay(day)}><span>{Number(day.slice(-2))}</span>{tradedDays.has(day) && <i aria-label="Trades logged" />}</button>)}</div><div className="selected-day-trades"><h3>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3><TradeTable trades={selectedTrades} detailed />{!selectedTrades.length && <p className="empty-hint">No trades logged on this day.</p>}</div></section>}

        {tab === 'reports' && <section className="reports-page"><div className="reports-heading"><div><span className="eyebrow">PERFORMANCE REVIEW</span><h2>How you traded</h2><p className="muted">A view of journaled outcomes and self-reported process habits.</p></div></div><div className="report-summary"><div className="panel report-stat"><span>Closed trades</span><strong>{insights.closed}</strong></div><div className="panel report-stat"><span>Wins / losses</span><strong>{insights.wins} <small>/</small> {insights.losses}</strong></div><div className="panel report-stat"><span>Followed plan</span><strong>{insights.planFollowingRate.toFixed(1)}<small>%</small></strong></div><div className="panel report-stat"><span>Traded days</span><strong>{insights.tradedDays}</strong></div></div><section className="panel report-chart"><div className="panel-heading"><div><span className="eyebrow">DAILY OUTCOMES</span><h2>Wins minus losses</h2></div></div><OutcomeChart rows={outcomeRows} /></section><section className="panel report-breakdown"><h3>Outcome breakdown</h3><div><span>Wins</span><b>{insights.wins}</b></div><div><span>Losses</span><b>{insights.losses}</b></div><div><span>Breakeven</span><b>{insights.breakeven}</b></div><div><span>Pending</span><b>{insights.pending}</b></div><p>These are journal labels, not balance, return, or financial-performance figures.</p></section></section>}

        {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}
      </main>
    </section>
  </div>;
}

function TradeTable({ trades, detailed = false }) {
  if (!trades.length) return <div className="empty-table">No journal entries in this view yet.</div>;
  return <div className="trade-table-wrap"><table className="trade-table"><thead><tr><th>SYMBOL</th><th>DAY</th><th>SETUP</th><th>OUTCOME</th><th>PLAN</th>{detailed && <th>NOTES</th>}</tr></thead><tbody>{trades.map((trade) => <tr key={trade.id}><td><strong>{trade.symbol}</strong><small>{trade.side.toUpperCase()}</small></td><td>{trade.trading_day}</td><td>{trade.setup}</td><td><span className={`outcome-pill ${trade.outcome ?? 'pending'}`}>{trade.outcome ?? 'Pending'}</span></td><td>{trade.followed_plan ? 'Followed' : 'Outside plan'}</td>{detailed && <td className="notes-cell"><span>{trade.reason}</span><small>{trade.emotion} · {trade.lesson}</small></td>}</tr>)}</tbody></table></div>;
}

