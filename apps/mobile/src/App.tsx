import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { TradeRecord, TradingAccount, TradingChecklist, TradingChecklistItem } from '@sultan/shared';
import { getDailyOutcomes, getTradeInsights, localTradingDay, monthCalendarDays } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from './lib/supabase';

export default function App() {
  type Tab = 'dashboard' | 'routine' | 'journal' | 'calendar' | 'accounts' | 'reports';
  type TradeDraft = { symbol: string; side: 'buy' | 'sell'; setup: string; reason: string; emotion: string; lesson: string; followed_plan: boolean; outcome: 'pending' | 'win' | 'loss' | 'breakeven' };
  const emptyTrade: TradeDraft = { symbol: '', side: 'buy', setup: '', reason: '', emotion: '', lesson: '', followed_plan: true, outcome: 'pending' };
  const [session, setSession] = useState<Session | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [checklists, setChecklists] = useState<TradingChecklist[]>([]);
  const [checklistId, setChecklistId] = useState('');
  const [items, setItems] = useState<TradingChecklistItem[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [tradeForm, setTradeForm] = useState<TradeDraft>(emptyTrade);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(localTradingDay());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [accountMode, setAccountMode] = useState<'demo' | 'live' | 'paper'>('demo');
  const [checklistName, setChecklistName] = useState('');
  const [itemDraft, setItemDraft] = useState('');
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 460, useNativeDriver: true }).start();
  }, [entrance]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setAccounts([]); setAccountId(''); return; }
    let active = true;
    void supabase.from('trading_accounts').select('*').eq('user_id', session.user.id).order('created_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setMessage(error.message); return; }
        const rows = (data ?? []) as TradingAccount[];
        setAccounts(rows);
        setAccountId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
      });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!supabase || !session?.user || !accountId) { setChecklists([]); setChecklistId(''); return; }
    let active = true;
    void supabase.from('trading_checklists').select('*').eq('user_id', session.user.id).eq('account_id', accountId).order('created_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setMessage(error.message); return; }
        const rows = (data ?? []) as TradingChecklist[];
        setChecklists(rows);
        setChecklistId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
      });
    return () => { active = false; };
  }, [session?.user.id, accountId]);

  useEffect(() => {
    if (!supabase || !session?.user || !accountId) { setTrades([]); return; }
    let active = true;
    void supabase.from('trading_journal_entries').select('*').eq('user_id', session.user.id).eq('account_id', accountId).order('trading_day', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setMessage(error.message); return; }
        setTrades((data ?? []) as TradeRecord[]);
      });
    return () => { active = false; };
  }, [session?.user.id, accountId]);

  useEffect(() => {
    if (!supabase || !session?.user || !checklistId) { setItems([]); setChecks({}); return; }
    let active = true;
    void (async () => {
      const { data, error } = await supabase.from('trading_checklist_items').select('*').eq('user_id', session.user.id).eq('checklist_id', checklistId).order('position');
      if (!active) return;
      if (error) { setMessage(error.message); return; }
      const rows = (data ?? []) as TradingChecklistItem[];
      setItems(rows);
      if (!rows.length) { setChecks({}); return; }
      const { data: doneRows, error: checksError } = await supabase.from('trading_checklist_checks').select('item_id,checked').eq('user_id', session.user.id).eq('trading_day', localTradingDay()).in('item_id', rows.map((item) => item.id));
      if (!active) return;
      if (checksError) { setMessage(checksError.message); return; }
      setChecks(Object.fromEntries((doneRows ?? []).map((row) => [row.item_id, row.checked])));
    })();
    return () => { active = false; };
  }, [session?.user.id, checklistId]);

  async function authenticate() {
    setMessage('');
    if (!supabase) { setMessage('Add Supabase settings to enable your account.'); return; }
    setBusy(true);
    const result = authMode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (authMode === 'signup' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
  }

  async function addAccount() {
    if (!supabase || !session?.user || !accountLabel.trim()) return;
    const { data, error } = await supabase.from('trading_accounts').insert({ user_id: session.user.id, label: accountLabel.trim(), broker_name: brokerName.trim() || null, mode: accountMode }).select().single();
    if (error) { setMessage(error.message); return; }
    setAccounts((rows) => [...rows, data as TradingAccount]); setAccountId(data.id); setAccountLabel(''); setBrokerName(''); setAccountOpen(false);
  }

  async function addChecklist() {
    if (!supabase || !session?.user || !accountId || !checklistName.trim()) return;
    const { data, error } = await supabase.from('trading_checklists').insert({ user_id: session.user.id, account_id: accountId, title: checklistName.trim() }).select().single();
    if (error) { setMessage(error.message); return; }
    setChecklists((rows) => [...rows, data as TradingChecklist]); setChecklistId(data.id); setChecklistName('');
  }

  async function addItem() {
    if (!supabase || !session?.user || !checklistId || !itemDraft.trim()) return;
    const { data, error } = await supabase.from('trading_checklist_items').insert({ user_id: session.user.id, checklist_id: checklistId, label: itemDraft.trim(), position: items.length }).select().single();
    if (error) { setMessage(error.message); return; }
    setItems((rows) => [...rows, data as TradingChecklistItem]); setItemDraft('');
  }

  async function toggleItem(item: TradingChecklistItem) {
    if (!supabase || !session?.user) return;
    const checked = !checks[item.id];
    setChecks((rows) => ({ ...rows, [item.id]: checked }));
    const { error } = await supabase.from('trading_checklist_checks').upsert({ user_id: session.user.id, item_id: item.id, trading_day: localTradingDay(), checked, updated_at: new Date().toISOString() }, { onConflict: 'item_id,trading_day' });
    if (error) { setChecks((rows) => ({ ...rows, [item.id]: !checked })); setMessage(error.message); }
  }

  async function deleteItem(item: TradingChecklistItem) {
    if (!supabase || !session?.user) return;
    const { error } = await supabase.from('trading_checklist_items').delete().eq('id', item.id).eq('user_id', session.user.id);
    if (error) { setMessage(error.message); return; }
    setItems((rows) => rows.filter((row) => row.id !== item.id));
    setChecks((rows) => { const next = { ...rows }; delete next[item.id]; return next; });
  }

  const complete = items.length > 0 && items.every((item) => checks[item.id]);
  async function logTrade() {
    if (!supabase || !session?.user || !accountId || !complete) return;
    setBusy(true);
    const payload = { ...tradeForm, symbol: tradeForm.symbol.trim().toUpperCase(), setup: tradeForm.setup.trim(), reason: tradeForm.reason.trim(), emotion: tradeForm.emotion.trim(), lesson: tradeForm.lesson.trim(), outcome: tradeForm.outcome || null, trading_day: localTradingDay(), account_id: accountId, user_id: session.user.id };
    const { data, error } = await supabase.from('trading_journal_entries').insert(payload).select().single();
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setTrades((rows) => [data as TradeRecord, ...rows]); setSelectedDay(payload.trading_day); setTradeForm(emptyTrade); setTab('journal'); setMessage('Trade saved to your journal.');
  }
  const calendarDays = monthCalendarDays(month);
  const tradedDays = new Set(trades.map((trade) => trade.trading_day));
  const selectedTrades = trades.filter((trade) => trade.trading_day === selectedDay);
  const insights = getTradeInsights(trades);
  const outcomeRows = getDailyOutcomes(trades);
  const cardContent = !accounts.length ? <View style={styles.empty}><View style={styles.plusMark}>＋</View><Text style={styles.cardTitle}>Add a trading account</Text><Text style={styles.body}>Create a Demo, Live, or Paper profile under this login. No broker password needed.</Text><TouchableOpacity style={styles.primary} onPress={() => setAccountOpen(true)}><Text style={styles.primaryText}>Add account</Text></TouchableOpacity></View> : (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>
        {accounts.map((account) => <TouchableOpacity key={account.id} onPress={() => setAccountId(account.id)} style={[styles.accountChip, account.id === accountId && styles.accountActive]}><Text style={styles.accountName}>{account.label}</Text><Text style={styles.accountMode}>{account.mode.toUpperCase()}</Text></TouchableOpacity>)}
        <TouchableOpacity style={styles.addAccount} onPress={() => setAccountOpen(true)}><Text style={styles.addAccountText}>＋ Account</Text></TouchableOpacity>
      </ScrollView>
      <View style={styles.checklistCard}>
        <View style={styles.cardHeader}><View><Text style={styles.eyebrow}>PRE-TRADE ROUTINE</Text><Text style={styles.cardTitle}>Checklist for the day</Text></View><Text style={styles.date}>{localTradingDay()}</Text></View>
        <View style={styles.listSelector}><Text style={styles.label}>YOUR CHECKLIST</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listRow}>{checklists.map((list) => <TouchableOpacity key={list.id} style={[styles.listChip, list.id === checklistId && styles.listSelected]} onPress={() => setChecklistId(list.id)}><Text style={styles.listText}>{list.title}</Text></TouchableOpacity>)}</ScrollView></View>
        <View style={styles.createRow}><TextInput value={checklistName} onChangeText={setChecklistName} placeholder="Name a checklist" placeholderTextColor="#8391a5" style={styles.input} /><TouchableOpacity style={styles.smallButton} onPress={() => void addChecklist()}><Text style={styles.smallButtonText}>＋ Create</Text></TouchableOpacity></View>
        {checklistId ? <>
          <View style={styles.progressRow}><Text style={styles.progressText}>{Object.values(checks).filter(Boolean).length} of {items.length} complete</Text><Text style={[styles.lockText, complete && styles.readyText]}>{complete ? 'READY' : 'LOG TRADE LOCKED'}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${items.length ? Object.values(checks).filter(Boolean).length / items.length * 100 : 0}%` }]} /></View>
          {items.map((item) => <View key={item.id} style={styles.checkRow}><TouchableOpacity onPress={() => void toggleItem(item)} style={[styles.checkbox, checks[item.id] && styles.checkboxDone]}><Text style={styles.checkMark}>{checks[item.id] ? '✓' : ''}</Text></TouchableOpacity><Text style={[styles.itemText, checks[item.id] && styles.itemDone]}>{item.label}</Text><TouchableOpacity onPress={() => void deleteItem(item)} style={styles.deleteButton}><Text style={styles.deleteText}>×</Text></TouchableOpacity></View>)}
          {!items.length && <Text style={styles.helper}>Add your rules below. You can change this checklist any time.</Text>}
          <View style={styles.createRow}><TextInput value={itemDraft} onChangeText={setItemDraft} placeholder="Add your checklist rule" placeholderTextColor="#8391a5" style={styles.input} /><TouchableOpacity style={styles.smallButton} onPress={() => void addItem()}><Text style={styles.smallButtonText}>Add</Text></TouchableOpacity></View>
          <TouchableOpacity disabled={!complete} style={[styles.logButton, !complete && styles.logDisabled]} onPress={() => complete && setTab('journal')}><Text style={[styles.logButtonText, !complete && styles.logDisabledText]}>Log trade  ↗</Text><Text style={styles.logHint}>{complete ? 'Open journal' : 'Complete every item first'}</Text></TouchableOpacity>
        </> : <Text style={styles.helper}>Create a checklist for this account, then add the rules you want to follow before each trade.</Text>}
      </View>
    </>
  );

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#f4f7fc" /><Animated.View style={[styles.animated, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
    {!session ? <KeyboardAvoidingView style={styles.auth} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View><View><Text style={styles.brand}>Sultan</Text><Text style={styles.tagline}>YOUR TRADING DESK</Text></View></View>
      <Text style={styles.eyebrow}>YOUR RULES. YOUR TRADING.</Text><Text style={styles.hero}>One trade at a time.</Text><Text style={styles.body}>Sign in to sync accounts and daily checklists across your devices.</Text>
      <TextInput style={styles.authInput} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#8392a8" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextInput style={styles.authInput} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#8392a8" secureTextEntry autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} />
      {message ? <Text style={styles.error}>{message}</Text> : null}{!isSupabaseConfigured ? <Text style={styles.error}>Supabase settings are not configured.</Text> : null}
      <TouchableOpacity style={styles.primary} onPress={() => void authenticate()} disabled={busy}>{busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>{authMode === 'signin' ? 'Sign in' : 'Create account'}  ↗</Text>}</TouchableOpacity>
      <TouchableOpacity onPress={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}><Text style={styles.authToggle}>{authMode === 'signin' ? 'Create an account' : 'Back to sign in'}</Text></TouchableOpacity>
    </KeyboardAvoidingView> : <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>Sultan</Text><Text style={styles.tagline}>TRADING DESK</Text></View><TouchableOpacity style={styles.signOut} onPress={() => void supabase?.auth.signOut()}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity></View>
      <Text style={styles.dateLong}>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</Text><Text style={styles.hero}>Trade with intention.</Text><Text style={styles.body}>Your accounts. Your rules. Your daily routine.</Text>
      {accounts.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{([['dashboard', 'Overview'], ['routine', 'Checklist'], ['journal', 'Journal'], ['calendar', 'Calendar'], ['accounts', 'Accounts'], ['reports', 'Reports']] as const).map(([key, label]) => <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}{key === 'journal' && trades.length ? ` · ${trades.length}` : ''}</Text></TouchableOpacity>)}</ScrollView>}
      {tab !== 'routine' && tab !== 'accounts' && accounts.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>{accounts.map((account) => <TouchableOpacity key={account.id} onPress={() => setAccountId(account.id)} style={[styles.accountChip, account.id === accountId && styles.accountActive]}><Text style={styles.accountName}>{account.label}</Text><Text style={styles.accountMode}>{account.mode.toUpperCase()}</Text></TouchableOpacity>)}</ScrollView>}
      {tab === 'dashboard' && !accounts.length && cardContent}
      {tab === 'dashboard' && !!accounts.length && <View style={styles.dashboardBlock}>
        <Text style={styles.eyebrow}>TRADING WORKSPACE</Text><Text style={styles.cardTitle}>Your trading overview</Text><Text style={styles.body}>Journal-based numbers for this account. No balance or P&L is inferred.</Text>
        <View style={styles.metricGrid}><View style={[styles.metricCard, styles.metricPrimary]}><Text style={styles.metricLabel}>WIN RATE</Text><Text style={styles.metricValue}>{insights.winRate.toFixed(1)}%</Text><Text style={styles.metricFoot}>{insights.wins} wins · {insights.closed} closed</Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>TRADES</Text><Text style={styles.metricValue}>{insights.total}</Text><Text style={styles.metricFoot}>{insights.tradedDays} traded days</Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>PLAN FOLLOWING</Text><Text style={styles.metricValue}>{insights.planFollowingRate.toFixed(1)}%</Text><Text style={styles.metricFoot}>{insights.planFollowingCount} entries followed plan</Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>WIN STREAK</Text><Text style={styles.metricValue}>{insights.currentWinStreak}</Text><Text style={styles.metricFoot}>consecutive latest wins</Text></View></View>
        <View style={styles.checklistCard}><Text style={styles.eyebrow}>PERFORMANCE</Text><Text style={styles.cardTitle}>Daily outcomes</Text><Text style={styles.helper}>Wins minus losses by trading day</Text><View style={styles.outcomeBars}>{outcomeRows.map((row) => <View key={row.day} style={styles.outcomeColumn}><View style={[styles.outcomeBar, { height: Math.max(6, Math.min(56, row.trades * 9)) }]} /><Text style={styles.outcomeDay}>{row.day.slice(5)}</Text></View>)}{!outcomeRows.length && <Text style={styles.helper}>Your outcomes will appear after you journal trades.</Text>}</View></View>
        <View style={styles.checklistCard}><View style={styles.cardHeader}><View><Text style={styles.eyebrow}>DAILY ROUTINE</Text><Text style={styles.cardTitle}>Checklist progress</Text></View><Text style={styles.date}>{Object.values(checks).filter(Boolean).length} / {items.length}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${items.length ? Object.values(checks).filter(Boolean).length / items.length * 100 : 0}%` }]} /></View><TouchableOpacity style={styles.primary} onPress={() => setTab('routine')}><Text style={styles.primaryText}>Open checklist →</Text></TouchableOpacity></View>
      </View>}
      {tab === 'routine' && cardContent}
      {tab === 'accounts' && <View style={styles.checklistCard}><Text style={styles.eyebrow}>ACCOUNT ORGANIZATION</Text><Text style={styles.cardTitle}>Trading accounts</Text><Text style={styles.body}>Use separate labels for Demo, Live, or Paper records. Never enter broker passwords.</Text><TouchableOpacity style={styles.primary} onPress={() => setAccountOpen(true)}><Text style={styles.primaryText}>＋ Add account</Text></TouchableOpacity>{accounts.map((account) => <TouchableOpacity key={account.id} onPress={() => { setAccountId(account.id); setTab('dashboard'); }} style={[styles.accountCard, account.id === accountId && styles.accountActive]}><Text style={styles.accountName}>{account.label}</Text><Text style={styles.accountMode}>{account.mode.toUpperCase()} · {account.broker_name || 'Account record only'}</Text></TouchableOpacity>)}</View>}
      {tab === 'reports' && <View style={styles.checklistCard}><Text style={styles.eyebrow}>PERFORMANCE REVIEW</Text><Text style={styles.cardTitle}>How you traded</Text><View style={styles.reportRow}><Text style={styles.reportLabel}>Closed trades</Text><Text style={styles.reportValue}>{insights.closed}</Text></View><View style={styles.reportRow}><Text style={styles.reportLabel}>Wins / losses</Text><Text style={styles.reportValue}>{insights.wins} / {insights.losses}</Text></View><View style={styles.reportRow}><Text style={styles.reportLabel}>Breakeven / pending</Text><Text style={styles.reportValue}>{insights.breakeven} / {insights.pending}</Text></View><View style={styles.reportRow}><Text style={styles.reportLabel}>Followed plan</Text><Text style={styles.reportValue}>{insights.planFollowingRate.toFixed(1)}%</Text></View><Text style={styles.helper}>These are journal labels, not balance or financial-return figures.</Text></View>}
      {tab === 'journal' && accountId && <View style={styles.checklistCard}>
        <View style={styles.cardHeader}><View><Text style={styles.eyebrow}>TRADE JOURNAL</Text><Text style={styles.cardTitle}>How you traded</Text></View><Text style={styles.date}>{localTradingDay()}</Text></View>
        {!complete && <View style={styles.gate}><Text style={styles.helper}>Finish today's checklist before logging a trade.</Text><TouchableOpacity onPress={() => setTab('routine')}><Text style={styles.authToggle}>Open checklist ↗</Text></TouchableOpacity></View>}
        <TextInput style={styles.formInput} value={tradeForm.symbol} onChangeText={(value) => setTradeForm((row) => ({ ...row, symbol: value }))} placeholder="Symbol (e.g. EURUSD)" placeholderTextColor="#8392a8" maxLength={24} />
        <View style={styles.formChips}>{(['buy', 'sell'] as const).map((side) => <TouchableOpacity key={side} style={[styles.modeChip, tradeForm.side === side && styles.modeChipActive]} onPress={() => setTradeForm((row) => ({ ...row, side }))}><Text style={styles.modeText}>{side.toUpperCase()}</Text></TouchableOpacity>)}</View>
        <TextInput style={styles.formInput} value={tradeForm.setup} onChangeText={(value) => setTradeForm((row) => ({ ...row, setup: value }))} placeholder="Setup name" placeholderTextColor="#8392a8" maxLength={120} />
        <TextInput style={[styles.formInput, styles.multiline]} value={tradeForm.reason} onChangeText={(value) => setTradeForm((row) => ({ ...row, reason: value }))} placeholder="Reason for the trade" placeholderTextColor="#8392a8" multiline maxLength={1000} />
        <TextInput style={styles.formInput} value={tradeForm.emotion} onChangeText={(value) => setTradeForm((row) => ({ ...row, emotion: value }))} placeholder="Emotion during the trade" placeholderTextColor="#8392a8" maxLength={80} />
        <View style={styles.formChips}>{(['pending', 'win', 'loss', 'breakeven'] as const).map((outcome) => <TouchableOpacity key={outcome} style={[styles.modeChip, tradeForm.outcome === outcome && styles.modeChipActive]} onPress={() => setTradeForm((row) => ({ ...row, outcome }))}><Text style={styles.modeText}>{outcome.toUpperCase()}</Text></TouchableOpacity>)}</View>
        <Text style={styles.label}>DID YOU FOLLOW YOUR PLAN?</Text><View style={styles.formChips}>{([true, false] as const).map((value) => <TouchableOpacity key={String(value)} style={[styles.modeChip, tradeForm.followed_plan === value && styles.modeChipActive]} onPress={() => setTradeForm((row) => ({ ...row, followed_plan: value }))}><Text style={styles.modeText}>{value ? 'YES' : 'NO'}</Text></TouchableOpacity>)}</View>
        <TextInput style={[styles.formInput, styles.multiline]} value={tradeForm.lesson} onChangeText={(value) => setTradeForm((row) => ({ ...row, lesson: value }))} placeholder="Lesson learned" placeholderTextColor="#8392a8" multiline maxLength={1000} />
        <TouchableOpacity style={[styles.primary, (!complete || busy) && styles.logDisabled]} disabled={!complete || busy || !tradeForm.symbol.trim() || !tradeForm.setup.trim() || !tradeForm.reason.trim() || !tradeForm.emotion.trim() || !tradeForm.lesson.trim()} onPress={() => void logTrade()}><Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save journal entry ↗'}</Text></TouchableOpacity>
        <Text style={styles.sectionHeading}>RECENT TRADES</Text>{trades.slice(0, 10).map((trade) => <View key={trade.id} style={styles.tradeEntry}><View style={styles.tradeTop}><Text style={styles.tradeSymbol}>{trade.symbol} · {trade.side.toUpperCase()}</Text><Text style={styles.tradeMeta}>{trade.trading_day}</Text></View><Text style={styles.tradeMeta}>{trade.setup} · {trade.outcome ?? 'pending'}</Text><Text style={styles.tradeBody}>{trade.reason}</Text><Text style={styles.tradeMeta}>{trade.emotion} · {trade.followed_plan ? 'Followed plan' : 'Outside plan'}</Text><Text style={styles.tradeBody}>Lesson: {trade.lesson}</Text></View>)}{!trades.length && <Text style={styles.helper}>Saved trade notes will appear here.</Text>}
      </View>}
      {tab === 'calendar' && accountId && <View style={styles.checklistCard}>
        <Text style={styles.eyebrow}>TRADING HISTORY</Text><Text style={styles.cardTitle}>Days you traded</Text><View style={styles.monthBar}><TouchableOpacity onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><Text style={styles.monthArrow}>‹</Text></TouchableOpacity><Text style={styles.monthName}>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)}</Text><TouchableOpacity onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><Text style={styles.monthArrow}>›</Text></TouchableOpacity></View>
        <View style={styles.calendarRow}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View><View style={styles.calendarGrid}>{calendarDays.map((day) => <TouchableOpacity key={day} accessibilityRole="button" accessibilityLabel={`${day}${tradedDays.has(day) ? ', traded' : ''}`} onPress={() => setSelectedDay(day)} style={[styles.calendarDay, day.slice(0, 7) !== localTradingDay(month).slice(0, 7) && styles.calendarOutside, tradedDays.has(day) && styles.calendarTraded, selectedDay === day && styles.calendarSelected]}><Text style={styles.calendarNumber}>{Number(day.slice(-2))}</Text>{tradedDays.has(day) && <View style={styles.calendarDot} />}</TouchableOpacity>)}</View>
        <Text style={styles.sectionHeading}>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>{selectedTrades.map((trade) => <View key={trade.id} style={styles.tradeEntry}><Text style={styles.tradeSymbol}>{trade.symbol} · {trade.side.toUpperCase()} · {trade.setup}</Text><Text style={styles.tradeBody}>{trade.reason}</Text><Text style={styles.tradeMeta}>{trade.outcome ?? 'pending'}</Text></View>)}{!selectedTrades.length && <Text style={styles.helper}>No trades logged on this day.</Text>}
      </View>}
      <Text style={styles.footer}>No broker passwords. No trade signals. Your process stays yours.</Text>
      {message ? <TouchableOpacity style={styles.notice} onPress={() => setMessage('')}><Text style={styles.noticeText}>{message}  ×</Text></TouchableOpacity> : null}
    </ScrollView>}
  </Animated.View>
  <Modal visible={accountOpen} transparent animationType="fade" onRequestClose={() => setAccountOpen(false)}><View style={styles.modalBack}><View style={styles.modalCard}><View style={styles.modalTop}><Text style={styles.cardTitle}>Add trading account</Text><TouchableOpacity onPress={() => setAccountOpen(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View><Text style={styles.body}>This is a label for organizing your journal. Don't enter broker credentials.</Text><TextInput style={styles.modalInput} value={accountLabel} onChangeText={setAccountLabel} placeholder="Account label, e.g. Demo 1" placeholderTextColor="#8392a8" maxLength={50} /><TextInput style={styles.modalInput} value={brokerName} onChangeText={setBrokerName} placeholder="Broker name (optional)" placeholderTextColor="#8392a8" maxLength={60} /><View style={styles.modeRow}>{(['demo', 'live', 'paper'] as const).map((mode) => <TouchableOpacity key={mode} onPress={() => setAccountMode(mode)} style={[styles.modeChip, accountMode === mode && styles.modeChipActive]}><Text style={styles.modeText}>{mode.toUpperCase()}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.primary} onPress={() => void addAccount()}><Text style={styles.primaryText}>Save account  ↗</Text></TouchableOpacity></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fc' }, animated: { flex: 1 },
  auth: { flex: 1, justifyContent: 'center', padding: 26 }, page: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1769d2' }, brandMarkText: { color: '#ffffff', fontSize: 19, fontWeight: '900' }, brand: { color: '#17243a', fontSize: 15, fontWeight: '800' }, tagline: { color: '#8392a8', fontSize: 7, letterSpacing: 1.4, marginTop: 3 },
  eyebrow: { color: '#1769d2', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 }, hero: { color: '#17243a', fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.4, marginTop: 10 }, body: { color: '#71819a', fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 18 }, authInput: { height: 48, borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 10, backgroundColor: '#ffffff', paddingHorizontal: 13, color: '#17243a', fontSize: 13, marginBottom: 10 }, primary: { height: 46, borderRadius: 10, backgroundColor: '#1769d2', alignItems: 'center', justifyContent: 'center', marginTop: 4 }, primaryText: { color: '#ffffff', fontSize: 12, fontWeight: '800' }, authToggle: { color: '#63758e', fontSize: 11, textAlign: 'center', padding: 15 }, error: { color: '#ac6b18', fontSize: 10, marginBottom: 10 },
  signOut: { padding: 9, borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 8 }, signOutText: { color: '#63758e', fontSize: 9 }, dateLong: { color: '#8391a5', fontSize: 8, letterSpacing: 1.4, fontWeight: '700' },
  accountRow: { gap: 8, paddingVertical: 18 }, accountChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#dbe4ef', backgroundColor: '#ffffff' }, accountActive: { borderColor: '#96bce8', backgroundColor: '#e8f2ff' }, accountName: { color: '#293d59', fontSize: 10, fontWeight: '700' }, accountMode: { color: '#8291a6', fontSize: 7, marginTop: 4, letterSpacing: 1 }, addAccount: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#c6d8ee', borderStyle: 'dashed', justifyContent: 'center' }, addAccountText: { color: '#1769d2', fontSize: 9, fontWeight: '700' },
  checklistCard: { padding: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d9e3f0', borderRadius: 14, marginTop: 3 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, cardTitle: { color: '#17243a', fontSize: 17, fontWeight: '700', marginTop: 6 }, date: { color: '#63758e', fontSize: 8, marginTop: 4 }, listSelector: { marginTop: 20 }, label: { color: '#71819a', fontSize: 7, fontWeight: '800', letterSpacing: 1.2 }, listRow: { gap: 7, paddingVertical: 9 }, listChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#d4e0ef', backgroundColor: '#f9fbff' }, listSelected: { borderColor: '#96bce8', backgroundColor: '#e8f2ff' }, listText: { color: '#445670', fontSize: 9 },
  createRow: { flexDirection: 'row', gap: 7, marginTop: 8 }, input: { flex: 1, height: 39, minWidth: 0, paddingHorizontal: 10, borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 8, backgroundColor: '#f9fbff', color: '#293d59', fontSize: 10 }, smallButton: { height: 39, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#c6d8ee', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' }, smallButtonText: { color: '#1769d2', fontSize: 9, fontWeight: '700' }, progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, progressText: { color: '#687b96', fontSize: 9 }, lockText: { color: '#8291a6', fontSize: 7, fontWeight: '800', letterSpacing: 1 }, readyText: { color: '#1769d2' }, track: { height: 3, borderRadius: 3, backgroundColor: '#e7edf5', marginTop: 8, marginBottom: 5 }, fill: { height: 3, borderRadius: 3, backgroundColor: '#1769d2' }, checkRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#edf2f8' }, checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: '#a9bbd0', alignItems: 'center', justifyContent: 'center' }, checkboxDone: { borderColor: '#1769d2', backgroundColor: '#1769d2' }, checkMark: { color: '#ffffff', fontSize: 11, fontWeight: '900' }, itemText: { flex: 1, color: '#293d59', fontSize: 11 }, itemDone: { color: '#8794a8', textDecorationLine: 'line-through' }, deleteButton: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#8392a8', fontSize: 18 }, helper: { color: '#8291a6', fontSize: 10, lineHeight: 16, marginTop: 12 }, logButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: '#bdd2eb', borderRadius: 9, backgroundColor: '#eaf3ff' }, logButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '800' }, logHint: { color: '#7d8da4', fontSize: 8, marginTop: 3 }, logDisabled: { borderColor: '#dbe4ef', backgroundColor: '#eff4fa' }, logDisabledText: { color: '#8291a6' },
  empty: { alignItems: 'center', marginTop: 38, padding: 24, borderWidth: 1, borderColor: '#d9e3f0', borderRadius: 14, backgroundColor: '#ffffff' }, plusMark: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: '#bfd4ec', alignItems: 'center', justifyContent: 'center', color: '#1769d2', fontSize: 22, marginBottom: 12 }, footer: { color: '#71819a', fontSize: 8, textAlign: 'center', marginTop: 22 }, notice: { position: 'absolute', bottom: 12, left: 15, right: 15, padding: 12, borderRadius: 9, backgroundColor: '#e8f2ff' }, noticeText: { color: '#315981', fontSize: 10 },
  modalBack: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#ffffffd9' }, modalCard: { padding: 19, borderRadius: 15, borderWidth: 1, borderColor: '#d4e0ef', backgroundColor: '#ffffff' }, modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { color: '#63758e', fontSize: 25 }, modalInput: { height: 44, borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 9, backgroundColor: '#f9fbff', paddingHorizontal: 11, color: '#17243a', fontSize: 11, marginTop: 10 }, modeRow: { flexDirection: 'row', gap: 7, marginTop: 12, marginBottom: 10 }, modeChip: { flex: 1, alignItems: 'center', padding: 9, borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 8 }, modeChipActive: { borderColor: '#8cb5e6', backgroundColor: '#e8f2ff' }, modeText: { color: '#50627c', fontSize: 8, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 5, padding: 4, marginVertical: 12, borderWidth: 1, borderColor: '#d9e3f0', borderRadius: 11, backgroundColor: '#eaf1fb' }, tab: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, tabActive: { backgroundColor: '#1769d2' }, tabText: { color: '#71819a', fontSize: 10, fontWeight: '600' }, tabTextActive: { color: '#ffffff' },
  gate: { padding: 10, borderRadius: 8, backgroundColor: '#fff8e8', marginTop: 13 }, formInput: { minHeight: 44, borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 9, backgroundColor: '#f9fbff', paddingHorizontal: 11, color: '#17243a', fontSize: 11, marginTop: 10 }, multiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 11 }, formChips: { flexDirection: 'row', gap: 6, marginTop: 10 }, sectionHeading: { color: '#1769d2', fontSize: 8, fontWeight: '800', letterSpacing: 1.3, marginTop: 20, marginBottom: 8 }, tradeEntry: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e9eff6', gap: 5 }, tradeTop: { flexDirection: 'row', justifyContent: 'space-between' }, tradeSymbol: { color: '#293d59', fontSize: 10, fontWeight: '700' }, tradeMeta: { color: '#8291a6', fontSize: 8 }, tradeBody: { color: '#5c6f89', fontSize: 9, lineHeight: 14 },
  monthBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 18 }, monthArrow: { width: 36, height: 36, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#1c3d72', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d4e0ef', borderRadius: 8, fontSize: 22 }, monthName: { color: '#1b2c45', fontSize: 11, fontWeight: '700' }, calendarRow: { flexDirection: 'row', justifyContent: 'space-around' }, weekday: { width: '13.8%', color: '#8392a8', textAlign: 'center', fontSize: 9 }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 7 }, calendarDay: { position: 'relative', width: '13.5%', minHeight: 47, padding: 6, borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 8, backgroundColor: '#ffffff' }, calendarOutside: { opacity: 0.38 }, calendarTraded: { borderColor: '#a8c9ec', backgroundColor: '#e8f2ff' }, calendarSelected: { borderColor: '#1769d2', borderWidth: 2 }, calendarNumber: { color: '#3d506d', fontSize: 9 }, calendarDot: { position: 'absolute', right: 6, bottom: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: '#1769d2' },
  dashboardBlock: { gap: 11, marginBottom: 16 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, metricCard: { width: '48%', minHeight: 103, padding: 12, borderWidth: 1, borderColor: '#d9e3f0', borderRadius: 11, backgroundColor: '#ffffff' }, metricPrimary: { borderLeftWidth: 3, borderLeftColor: '#1769d2' }, metricLabel: { color: '#71819a', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }, metricValue: { color: '#17243a', fontSize: 22, fontWeight: '800', marginTop: 8 }, metricFoot: { color: '#8391a5', fontSize: 8, marginTop: 4 }, outcomeBars: { minHeight: 93, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 17, paddingBottom: 3 }, outcomeColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 }, outcomeBar: { width: '80%', borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#287bdd' }, outcomeDay: { color: '#8695a9', fontSize: 7 }, accountCard: { padding: 12, marginTop: 9, borderWidth: 1, borderColor: '#d9e3f0', borderRadius: 9, backgroundColor: '#ffffff' }, reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, marginTop: 3, borderBottomWidth: 1, borderBottomColor: '#e7edf5' }, reportLabel: { color: '#71819a', fontSize: 10 }, reportValue: { color: '#17243a', fontSize: 11, fontWeight: '800' },
});

