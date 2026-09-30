import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Mt5Deal, TradeRecord, TradingAccount, TradingChecklist, TradingChecklistItem } from '@sultan/shared';
import { getMt5Insights, getMt5PositionSummaries, getTradeInsights, localTradingDay, monthCalendarDays } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from './lib/supabase';

declare global { interface Window { tradeosWindow: { minimize: () => void; close: () => void } } }

export default function App() {
  type Tab = 'routine' | 'journal' | 'calendar' | 'stats';
  type TradeDraft = { symbol: string; side: 'buy' | 'sell'; setup: string; reason: string; emotion: string; lesson: string; followed_plan: boolean; outcome: 'pending' | 'win' | 'loss' | 'breakeven' };
  const emptyTrade: TradeDraft = { symbol: '', side: 'buy', setup: '', reason: '', emotion: '', lesson: '', followed_plan: true, outcome: 'pending' };
  const [session, setSession] = useState<Session | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [lists, setLists] = useState<TradingChecklist[]>([]);
  const [listId, setListId] = useState('');
  const [items, setItems] = useState<TradingChecklistItem[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [mt5Deals, setMt5Deals] = useState<Mt5Deal[]>([]);
  const [tab, setTab] = useState<Tab>('routine');
  const [tradeForm, setTradeForm] = useState<TradeDraft>(emptyTrade);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(localTradingDay());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [accountName, setAccountName] = useState('');
  const [accountMode, setAccountMode] = useState<'demo' | 'live' | 'paper'>('demo');
  const [listName, setListName] = useState('');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) { setAccounts([]); setAccountId(''); return; }
    let live = true;
    void supabase.from('trading_accounts').select('*').eq('user_id', session.user.id).order('created_at').then(({ data, error }) => {
      if (!live) return;
      if (error) setMessage(error.message);
      const rows = (data ?? []) as TradingAccount[];
      setAccounts(rows); setAccountId((id) => rows.some((row) => row.id === id) ? id : rows[0]?.id ?? '');
    });
    return () => { live = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!supabase || !session || !accountId) { setLists([]); setListId(''); return; }
    let live = true;
    void supabase.from('trading_checklists').select('*').eq('user_id', session.user.id).eq('account_id', accountId).order('created_at').then(({ data, error }) => {
      if (!live) return;
      if (error) setMessage(error.message);
      const rows = (data ?? []) as TradingChecklist[];
      setLists(rows); setListId((id) => rows.some((row) => row.id === id) ? id : rows[0]?.id ?? '');
    });
    return () => { live = false; };
  }, [session?.user.id, accountId]);

  useEffect(() => {
    if (!supabase || !session || !accountId) { setTrades([]); return; }
    let live = true;
    void supabase.from('trading_journal_entries').select('*').eq('user_id', session.user.id).eq('account_id', accountId).order('trading_day', { ascending: false }).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!live) return;
      if (error) setMessage(error.message);
      setTrades((data ?? []) as TradeRecord[]);
    });
    return () => { live = false; };
  }, [session?.user.id, accountId]);

  useEffect(() => {
    const client = supabase;
    const userId = session?.user.id;
    if (!client || !userId || !accountId) { setMt5Deals([]); return; }
    let live = true;
    const loadDeals = async () => {
      const allRows: Mt5Deal[] = [];
      for (let from = 0; from < 100000; from += 1000) {
        const { data, error } = await client.from('mt5_deals').select('*').eq('user_id', userId).eq('account_id', accountId).order('time_msc', { ascending: false }).range(from, from + 999);
        if (!live) return;
        if (error) { setMessage(error.message); return; }
        const rows = (data ?? []) as Mt5Deal[];
        allRows.push(...rows);
        if (rows.length < 1000) break;
      }
      if (live) setMt5Deals(allRows);
    };
    void loadDeals();
    const channel = client.channel(`desktop-mt5-deals-${accountId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mt5_deals', filter: `account_id=eq.${accountId}` }, () => { void loadDeals(); }).subscribe();
    return () => { live = false; void client.removeChannel(channel); };
  }, [session?.user.id, accountId]);

  useEffect(() => {
    if (!supabase || !session || !listId) { setItems([]); setChecks({}); return; }
    let live = true;
    void (async () => {
      const { data, error } = await supabase.from('trading_checklist_items').select('*').eq('user_id', session.user.id).eq('checklist_id', listId).order('position');
      if (!live) return;
      if (error) { setMessage(error.message); return; }
      const rows = (data ?? []) as TradingChecklistItem[]; setItems(rows);
      if (!rows.length) { setChecks({}); return; }
      const { data: done, error: checksError } = await supabase.from('trading_checklist_checks').select('item_id,checked').eq('user_id', session.user.id).eq('trading_day', localTradingDay()).in('item_id', rows.map((row) => row.id));
      if (!live) return;
      if (checksError) setMessage(checksError.message);
      setChecks(Object.fromEntries((done ?? []).map((row) => [row.item_id, row.checked])));
    })();
    return () => { live = false; };
  }, [session?.user.id, listId]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) { setMessage('Configure Supabase URL and publishable key first.'); return; }
    setBusy(true); setMessage('');
    const result = authMode === 'signin' ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (authMode === 'signup' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
  }

  async function createAccount() {
    if (!supabase || !session || !accountName.trim()) return;
    const { data, error } = await supabase.from('trading_accounts').insert({ user_id: session.user.id, label: accountName.trim(), mode: accountMode }).select().single();
    if (error) { setMessage(error.message); return; }
    const row = data as TradingAccount; setAccounts((rows) => [...rows, row]); setAccountId(row.id); setAccountName('');
  }

  async function createList() {
    if (!supabase || !session || !accountId || !listName.trim()) return;
    const { data, error } = await supabase.from('trading_checklists').insert({ user_id: session.user.id, account_id: accountId, title: listName.trim() }).select().single();
    if (error) { setMessage(error.message); return; }
    const row = data as TradingChecklist; setLists((rows) => [...rows, row]); setListId(row.id); setListName('');
  }

  async function addItem() {
    if (!supabase || !session || !listId || !draft.trim()) return;
    const { data, error } = await supabase.from('trading_checklist_items').insert({ user_id: session.user.id, checklist_id: listId, label: draft.trim(), position: items.length }).select().single();
    if (error) { setMessage(error.message); return; }
    setItems((rows) => [...rows, data as TradingChecklistItem]); setDraft('');
  }

  async function toggle(item: TradingChecklistItem) {
    if (!supabase || !session) return;
    const checked = !checks[item.id]; setChecks((rows) => ({ ...rows, [item.id]: checked }));
    const { error } = await supabase.from('trading_checklist_checks').upsert({ user_id: session.user.id, item_id: item.id, trading_day: localTradingDay(), checked, updated_at: new Date().toISOString() }, { onConflict: 'item_id,trading_day' });
    if (error) { setChecks((rows) => ({ ...rows, [item.id]: !checked })); setMessage(error.message); }
  }

  async function removeItem(item: TradingChecklistItem) {
    if (!supabase || !session) return;
    const { error } = await supabase.from('trading_checklist_items').delete().eq('id', item.id).eq('user_id', session.user.id);
    if (error) { setMessage(error.message); return; }
    setItems((rows) => rows.filter((row) => row.id !== item.id));
  }

  const complete = items.length > 0 && items.every((item) => checks[item.id]);
  async function logTrade() {
    if (!supabase || !session || !accountId || !complete) return;
    setBusy(true);
    const payload = { ...tradeForm, symbol: tradeForm.symbol.trim().toUpperCase(), setup: tradeForm.setup.trim(), reason: tradeForm.reason.trim(), emotion: tradeForm.emotion.trim(), lesson: tradeForm.lesson.trim(), outcome: tradeForm.outcome || null, trading_day: localTradingDay(), account_id: accountId, user_id: session.user.id };
    const { data, error } = await supabase.from('trading_journal_entries').insert(payload).select().single();
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setTrades((rows) => [data as TradeRecord, ...rows]); setTradeForm(emptyTrade); setSelectedDay(payload.trading_day); setTab('journal'); setMessage('Trade saved.');
  }
  const calendarDays = useMemo(() => monthCalendarDays(month), [month]);
  const mt5Positions = useMemo(() => getMt5PositionSummaries(mt5Deals), [mt5Deals]);
  const mt5Insights = useMemo(() => getMt5Insights(mt5Positions), [mt5Positions]);
  const importedDays = mt5Positions.map((position) => localTradingDay(new Date(position.openedAt)));
  const tradedDays = useMemo(() => new Set([...trades.map((trade) => trade.trading_day), ...importedDays]), [trades, importedDays]);
  const selectedTrades = trades.filter((trade) => trade.trading_day === selectedDay);
  const selectedMt5Positions = mt5Positions.filter((position) => localTradingDay(new Date(position.openedAt)) === selectedDay);
  const insights = getTradeInsights(trades);
  return <main className="window">
    <header className="titlebar"><div className="brand"><span className="brand-mark">S</span><span>Sultan <small>TRADING PANEL</small></span></div><div className="window-actions"><button aria-label="Minimize" onClick={() => window.tradeosWindow.minimize()}>−</button><button aria-label="Close" onClick={() => window.tradeosWindow.close()}>×</button></div></header>
    {!session ? <section className="auth"><div className="eyebrow">YOUR PRIVATE TRADING DESK</div><h1>One trade at a time.</h1><p className="intro">Sign in to sync your accounts and checklist across devices.</p><form onSubmit={(event) => void authenticate(event)}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required /></label>{message && <p className="error" role="alert">{message}</p>}{!isSupabaseConfigured && <p className="hint">Supabase settings are not configured.</p>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : authMode === 'signin' ? 'Sign in ↗' : 'Create account ↗'}</button></form><button className="text-button auth-toggle" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>{authMode === 'signin' ? 'Create an account' : 'Back to sign in'}</button></section> : <section className="workspace">
      <div className="dayline"><span className="eyebrow">PRE-TRADE ROUTINE</span><span>{localTradingDay()}</span></div><h1>Checklist for the day</h1><p className="intro">Your rules, beside your chart.</p>
      <div className="account-area"><div className="field-label">TRADING ACCOUNT</div><div className="account-row">{accounts.map((account) => <button key={account.id} className={`chip ${account.id === accountId ? 'active' : ''}`} onClick={() => setAccountId(account.id)}>{account.label}<small>{account.mode.toUpperCase()}</small></button>)}</div><div className="create-row"><input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="New account name" maxLength={50} /><select value={accountMode} onChange={(e) => setAccountMode(e.target.value as typeof accountMode)}><option value="demo">Demo</option><option value="live">Live</option><option value="paper">Paper</option></select><button className="small-button" onClick={() => void createAccount()}>＋</button></div></div>
      {accountId && <nav className="tabs">{([['routine', 'Checklist'], ['journal', 'Journal'], ['calendar', 'Calendar'], ['stats', 'Stats']] as const).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>}
      {!accountId && <p className="hint">Add an account to start using your trading desk.</p>}
      {tab === 'routine' && accountId && <><div className="list-area"><div className="field-label">CHECKLIST</div><div className="account-row">{lists.map((list) => <button key={list.id} className={`chip ${list.id === listId ? 'active' : ''}`} onClick={() => setListId(list.id)}>{list.title}</button>)}</div><div className="create-row"><input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Name a checklist" maxLength={60} /><button className="small-button" onClick={() => void createList()}>Create</button></div></div>
      {listId && <><div className="progress"><span>{Object.values(checks).filter(Boolean).length} of {items.length} complete</span><b className={complete ? 'ready' : ''}>{complete ? 'READY' : 'LOG TRADE LOCKED'}</b></div><div className="track"><i style={{ width: `${items.length ? Object.values(checks).filter(Boolean).length / items.length * 100 : 0}%` }} /></div><div className="items">{items.map((item) => <div className="check-row" key={item.id}><button className={`checkbox ${checks[item.id] ? 'done' : ''}`} aria-label={`${checks[item.id] ? 'Uncheck' : 'Check'} ${item.label}`} onClick={() => void toggle(item)}>{checks[item.id] ? '✓' : ''}</button><span className={checks[item.id] ? 'item-done' : ''}>{item.label}</span><button className="remove" aria-label={`Remove ${item.label}`} onClick={() => void removeItem(item)}>×</button></div>)}</div>{!items.length && <p className="hint">Add your own pre-trade rules below.</p>}<div className="create-row item-create"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }} placeholder="Add your checklist rule" maxLength={120} /><button className="small-button" onClick={() => void addItem()}>Add</button></div><button className="log-button" disabled={!complete} onClick={() => complete && setTab('journal')}>Log trade <small>{complete ? 'Open journal' : 'Complete every item first'}</small></button></>}</>}
      {tab === 'journal' && accountId && <div className="journal-panel"><div className="eyebrow">TRADE JOURNAL · {localTradingDay()}</div><h2>How you traded</h2>{!complete && <p className="hint">Complete today's checklist first. <button className="text-button" onClick={() => setTab('routine')}>Open checklist</button></p>}
        <div className="create-row"><input value={tradeForm.symbol} onChange={(e) => setTradeForm((row) => ({ ...row, symbol: e.target.value }))} placeholder="Symbol" maxLength={24} /><select value={tradeForm.side} onChange={(e) => setTradeForm((row) => ({ ...row, side: e.target.value as TradeDraft['side'] }))}><option value="buy">Buy</option><option value="sell">Sell</option></select></div>
        <input className="journal-input" value={tradeForm.setup} onChange={(e) => setTradeForm((row) => ({ ...row, setup: e.target.value }))} placeholder="Setup" maxLength={120} />
        <textarea className="journal-input" value={tradeForm.reason} onChange={(e) => setTradeForm((row) => ({ ...row, reason: e.target.value }))} placeholder="Reason" maxLength={1000} />
        <input className="journal-input" value={tradeForm.emotion} onChange={(e) => setTradeForm((row) => ({ ...row, emotion: e.target.value }))} placeholder="Emotion" maxLength={80} />
        <textarea className="journal-input" value={tradeForm.lesson} onChange={(e) => setTradeForm((row) => ({ ...row, lesson: e.target.value }))} placeholder="Lesson" maxLength={1000} />
        <div className="create-row"><select value={tradeForm.outcome} onChange={(e) => setTradeForm((row) => ({ ...row, outcome: e.target.value as TradeDraft['outcome'] }))}><option value="pending">Pending</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select><select value={String(tradeForm.followed_plan)} onChange={(e) => setTradeForm((row) => ({ ...row, followed_plan: e.target.value === 'true' }))}><option value="true">Followed plan</option><option value="false">Outside plan</option></select></div>
        <button className="log-button" disabled={!complete || busy || !tradeForm.symbol.trim() || !tradeForm.setup.trim() || !tradeForm.reason.trim() || !tradeForm.emotion.trim() || !tradeForm.lesson.trim()} onClick={() => void logTrade()}>{busy ? 'Saving…' : 'Save journal entry ↗'}</button><div className="journal-list">{trades.slice(0, 10).map((trade) => <article key={trade.id}><strong>{trade.symbol} · {trade.side.toUpperCase()}</strong><small>{trade.trading_day} · {trade.setup} · {trade.outcome ?? 'Pending'}</small><p>{trade.reason}</p><small>{trade.emotion} · {trade.followed_plan ? 'Followed plan' : 'Outside plan'}</small><p>Lesson: {trade.lesson}</p></article>)}</div>
      </div>}
      {tab === 'calendar' && accountId && <div className="calendar-panel"><div className="eyebrow">TRADING HISTORY</div><h2>Days you traded</h2><div className="month-bar"><button aria-label="Previous month" onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>‹</button><strong>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)}</strong><button aria-label="Next month" onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>›</button></div><div className="calendar-grid weekdays">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}</div><div className="calendar-grid">{calendarDays.map((day) => <button key={day} aria-label={`${day}${tradedDays.has(day) ? ', traded' : ''}`} className={`calendar-day ${day.slice(0, 7) !== localTradingDay(month).slice(0, 7) ? 'outside' : ''} ${tradedDays.has(day) ? 'traded' : ''} ${selectedDay === day ? 'selected' : ''}`} onClick={() => setSelectedDay(day)}>{Number(day.slice(-2))}{tradedDays.has(day) && <i />}</button>)}</div><div className="journal-list"><strong>{selectedDay}</strong>{selectedTrades.map((trade) => <article key={trade.id}><strong>{trade.symbol} · {trade.side.toUpperCase()}</strong><small>{trade.setup} · {trade.outcome ?? 'Pending'}</small><p>{trade.reason}</p></article>)}{!selectedTrades.length && <p className="hint">No trades logged this day.</p>}</div></div>}
      {tab === 'stats' && accountId && <div className="calendar-panel stats-panel"><div className="eyebrow">PROCESS REVIEW</div><h2>Your trading stats</h2><div className="stats-mini"><div><small>WIN RATE</small><strong>{insights.winRate.toFixed(1)}%</strong></div><div><small>TRADES</small><strong>{insights.total}</strong></div><div><small>PLAN FOLLOWING</small><strong>{insights.planFollowingRate.toFixed(0)}%</strong></div><div><small>WIN STREAK</small><strong>{insights.currentWinStreak}</strong></div></div><p className="hint">Based on journal outcomes and your own plan-following answers. No balance or P&amp;L is inferred.</p></div>}
      {tab === 'journal' && accountId && <section className="journal-panel"><div className="eyebrow">IMPORTED FROM MT5</div><h2>Broker trade history</h2><div className="journal-list">{mt5Positions.slice(0, 12).map((position) => <article key={position.key}><strong>{position.symbol} · {position.side.toUpperCase()} · {position.status}</strong><small>{new Date(position.openedAt).toLocaleString()} · {position.volume.toFixed(2)} lots</small><p>{position.status === 'closed' ? position.netProfit.toFixed(2) + ' ' + (position.currency || '') : 'Position is open'}</p></article>)}{!mt5Positions.length && <p className="hint">Connect MT5 from Sultan web to see imported history here.</p>}</div></section>}
      {tab === 'calendar' && accountId && selectedMt5Positions.length > 0 && <section className="journal-panel"><div className="eyebrow">MT5 · {selectedDay}</div><h2>Imported positions</h2><div className="journal-list">{selectedMt5Positions.map((position) => <article key={position.key}><strong>{position.symbol} · {position.side.toUpperCase()}</strong><small>{position.status} · {position.volume.toFixed(2)} lots</small><p>{position.status === 'closed' ? position.netProfit.toFixed(2) + ' ' + (position.currency || '') : 'Position is open'}</p></article>)}</div></section>}
      {tab === 'stats' && accountId && <section className="journal-panel"><div className="eyebrow">MT5 ACCOUNT RESULTS</div><h2>Broker history</h2><div className="journal-list"><article><strong>Realized net</strong><p>{mt5Insights.realizedNet.toFixed(2)} {mt5Insights.currency}</p></article><article><strong>Closed / open</strong><p>{mt5Insights.closed} / {mt5Insights.open}</p></article><article><strong>Wins / losses</strong><p>{mt5Insights.wins} / {mt5Insights.losses} · {mt5Insights.winRate.toFixed(1)}% win rate</p></article><article><strong>Buy / sell</strong><p>{mt5Insights.buys} / {mt5Insights.sells} · {mt5Insights.lots.toFixed(2)} lots</p></article>{!mt5Positions.length && <p className="hint">Connect MT5 from Sultan web to import your account history.</p>}</div></section>}      <div className="account-bottom"><span title={session.user.email}>{session.user.email}</span><button className="text-button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div>{message && <p className="message" role="status">{message}<button onClick={() => setMessage('')}>×</button></p>}
    </section>}
    <footer>No broker passwords. No signals. Just your process.</footer>
  </main>;
}

