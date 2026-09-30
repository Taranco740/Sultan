import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { TradingAccount, TradingChecklist, TradingChecklistItem } from '@sultan/shared';
import { localTradingDay } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [checklists, setChecklists] = useState<TradingChecklist[]>([]);
  const [checklistId, setChecklistId] = useState('');
  const [items, setItems] = useState<TradingChecklistItem[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
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
  const cardContent = !accounts.length ? <View style={styles.empty}><View style={styles.plusMark}>＋</View><Text style={styles.cardTitle}>Add a trading account</Text><Text style={styles.body}>Create a Demo, Live, or Paper profile under this login. No broker password needed.</Text><TouchableOpacity style={styles.primary} onPress={() => setAccountOpen(true)}><Text style={styles.primaryText}>Add account</Text></TouchableOpacity></View> : (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>
        {accounts.map((account) => <TouchableOpacity key={account.id} onPress={() => setAccountId(account.id)} style={[styles.accountChip, account.id === accountId && styles.accountActive]}><Text style={styles.accountName}>{account.label}</Text><Text style={styles.accountMode}>{account.mode.toUpperCase()}</Text></TouchableOpacity>)}
        <TouchableOpacity style={styles.addAccount} onPress={() => setAccountOpen(true)}><Text style={styles.addAccountText}>＋ Account</Text></TouchableOpacity>
      </ScrollView>
      <View style={styles.checklistCard}>
        <View style={styles.cardHeader}><View><Text style={styles.eyebrow}>PRE-TRADE ROUTINE</Text><Text style={styles.cardTitle}>Checklist for the day</Text></View><Text style={styles.date}>{localTradingDay()}</Text></View>
        <View style={styles.listSelector}><Text style={styles.label}>YOUR CHECKLIST</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listRow}>{checklists.map((list) => <TouchableOpacity key={list.id} style={[styles.listChip, list.id === checklistId && styles.listSelected]} onPress={() => setChecklistId(list.id)}><Text style={styles.listText}>{list.title}</Text></TouchableOpacity>)}</ScrollView></View>
        <View style={styles.createRow}><TextInput value={checklistName} onChangeText={setChecklistName} placeholder="Name a checklist" placeholderTextColor="#6e7b80" style={styles.input} /><TouchableOpacity style={styles.smallButton} onPress={() => void addChecklist()}><Text style={styles.smallButtonText}>＋ Create</Text></TouchableOpacity></View>
        {checklistId ? <>
          <View style={styles.progressRow}><Text style={styles.progressText}>{Object.values(checks).filter(Boolean).length} of {items.length} complete</Text><Text style={[styles.lockText, complete && styles.readyText]}>{complete ? 'READY' : 'LOG TRADE LOCKED'}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${items.length ? Object.values(checks).filter(Boolean).length / items.length * 100 : 0}%` }]} /></View>
          {items.map((item) => <View key={item.id} style={styles.checkRow}><TouchableOpacity onPress={() => void toggleItem(item)} style={[styles.checkbox, checks[item.id] && styles.checkboxDone]}><Text style={styles.checkMark}>{checks[item.id] ? '✓' : ''}</Text></TouchableOpacity><Text style={[styles.itemText, checks[item.id] && styles.itemDone]}>{item.label}</Text><TouchableOpacity onPress={() => void deleteItem(item)} style={styles.deleteButton}><Text style={styles.deleteText}>×</Text></TouchableOpacity></View>)}
          {!items.length && <Text style={styles.helper}>Add your rules below. You can change this checklist any time.</Text>}
          <View style={styles.createRow}><TextInput value={itemDraft} onChangeText={setItemDraft} placeholder="Add your checklist rule" placeholderTextColor="#6e7b80" style={styles.input} /><TouchableOpacity style={styles.smallButton} onPress={() => void addItem()}><Text style={styles.smallButtonText}>Add</Text></TouchableOpacity></View>
          <TouchableOpacity disabled={!complete} style={[styles.logButton, !complete && styles.logDisabled]} onPress={() => setMessage('Checklist complete. Your Journal module will appear in the next phase.')}><Text style={[styles.logButtonText, !complete && styles.logDisabledText]}>Log trade  ↗</Text><Text style={styles.logHint}>{complete ? 'Checklist complete' : 'Complete every item first'}</Text></TouchableOpacity>
        </> : <Text style={styles.helper}>Create a checklist for this account, then add the rules you want to follow before each trade.</Text>}
      </View>
    </>
  );

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor="#080c10" /><Animated.View style={[styles.animated, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
    {!session ? <KeyboardAvoidingView style={styles.auth} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View><View><Text style={styles.brand}>TradeOS</Text><Text style={styles.tagline}>YOUR TRADING DESK</Text></View></View>
      <Text style={styles.eyebrow}>YOUR RULES. YOUR TRADING.</Text><Text style={styles.hero}>One trade at a time.</Text><Text style={styles.body}>Sign in to sync accounts and daily checklists across your devices.</Text>
      <TextInput style={styles.authInput} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#718087" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextInput style={styles.authInput} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#718087" secureTextEntry autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} />
      {message ? <Text style={styles.error}>{message}</Text> : null}{!isSupabaseConfigured ? <Text style={styles.error}>Supabase settings are not configured.</Text> : null}
      <TouchableOpacity style={styles.primary} onPress={() => void authenticate()} disabled={busy}>{busy ? <ActivityIndicator color="#102016" /> : <Text style={styles.primaryText}>{authMode === 'signin' ? 'Sign in' : 'Create account'}  ↗</Text>}</TouchableOpacity>
      <TouchableOpacity onPress={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}><Text style={styles.authToggle}>{authMode === 'signin' ? 'Create an account' : 'Back to sign in'}</Text></TouchableOpacity>
    </KeyboardAvoidingView> : <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>TradeOS</Text><Text style={styles.tagline}>TRADING DESK</Text></View><TouchableOpacity style={styles.signOut} onPress={() => void supabase?.auth.signOut()}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity></View>
      <Text style={styles.dateLong}>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</Text><Text style={styles.hero}>Trade with intention.</Text><Text style={styles.body}>Your accounts. Your rules. Your daily routine.</Text>
      {cardContent}
      <Text style={styles.footer}>No broker passwords. No trade signals. Your process stays yours.</Text>
      {message ? <TouchableOpacity style={styles.notice} onPress={() => setMessage('')}><Text style={styles.noticeText}>{message}  ×</Text></TouchableOpacity> : null}
    </ScrollView>}
  </Animated.View>
  <Modal visible={accountOpen} transparent animationType="fade" onRequestClose={() => setAccountOpen(false)}><View style={styles.modalBack}><View style={styles.modalCard}><View style={styles.modalTop}><Text style={styles.cardTitle}>Add trading account</Text><TouchableOpacity onPress={() => setAccountOpen(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View><Text style={styles.body}>This is a label for organizing your journal. Don't enter broker credentials.</Text><TextInput style={styles.modalInput} value={accountLabel} onChangeText={setAccountLabel} placeholder="Account label, e.g. Demo 1" placeholderTextColor="#718087" maxLength={50} /><TextInput style={styles.modalInput} value={brokerName} onChangeText={setBrokerName} placeholder="Broker name (optional)" placeholderTextColor="#718087" maxLength={60} /><View style={styles.modeRow}>{(['demo', 'live', 'paper'] as const).map((mode) => <TouchableOpacity key={mode} onPress={() => setAccountMode(mode)} style={[styles.modeChip, accountMode === mode && styles.modeChipActive]}><Text style={styles.modeText}>{mode.toUpperCase()}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.primary} onPress={() => void addAccount()}><Text style={styles.primaryText}>Save account  ↗</Text></TouchableOpacity></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080c10' }, animated: { flex: 1 },
  auth: { flex: 1, justifyContent: 'center', padding: 26 }, page: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9be49c' }, brandMarkText: { color: '#102016', fontSize: 19, fontWeight: '900' }, brand: { color: '#eff3f0', fontSize: 15, fontWeight: '800' }, tagline: { color: '#77847f', fontSize: 7, letterSpacing: 1.4, marginTop: 3 },
  eyebrow: { color: '#9be49c', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 }, hero: { color: '#eff3f0', fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.4, marginTop: 10 }, body: { color: '#99a5a8', fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 18 }, authInput: { height: 48, borderWidth: 1, borderColor: '#2d393e', borderRadius: 10, backgroundColor: '#11181d', paddingHorizontal: 13, color: '#eff3f0', fontSize: 13, marginBottom: 10 }, primary: { height: 46, borderRadius: 10, backgroundColor: '#9be49c', alignItems: 'center', justifyContent: 'center', marginTop: 4 }, primaryText: { color: '#102016', fontSize: 12, fontWeight: '800' }, authToggle: { color: '#a6b4ab', fontSize: 11, textAlign: 'center', padding: 15 }, error: { color: '#f3bd7c', fontSize: 10, marginBottom: 10 },
  signOut: { padding: 9, borderWidth: 1, borderColor: '#334047', borderRadius: 8 }, signOutText: { color: '#aab5b3', fontSize: 9 }, dateLong: { color: '#82908d', fontSize: 8, letterSpacing: 1.4, fontWeight: '700' },
  accountRow: { gap: 8, paddingVertical: 18 }, accountChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#29353a', backgroundColor: '#11181d' }, accountActive: { borderColor: '#527059', backgroundColor: '#1a2820' }, accountName: { color: '#e6ece8', fontSize: 10, fontWeight: '700' }, accountMode: { color: '#8a9990', fontSize: 7, marginTop: 4, letterSpacing: 1 }, addAccount: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#3b4b41', borderStyle: 'dashed', justifyContent: 'center' }, addAccountText: { color: '#a8e6ad', fontSize: 9, fontWeight: '700' },
  checklistCard: { padding: 16, backgroundColor: '#11181d', borderWidth: 1, borderColor: '#29353b', borderRadius: 14, marginTop: 3 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, cardTitle: { color: '#eff3f0', fontSize: 17, fontWeight: '700', marginTop: 6 }, date: { color: '#9facaa', fontSize: 8, marginTop: 4 }, listSelector: { marginTop: 20 }, label: { color: '#7f8c89', fontSize: 7, fontWeight: '800', letterSpacing: 1.2 }, listRow: { gap: 7, paddingVertical: 9 }, listChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#2d393e', backgroundColor: '#0d1317' }, listSelected: { borderColor: '#55755b', backgroundColor: '#1b2a20' }, listText: { color: '#c6d0cb', fontSize: 9 },
  createRow: { flexDirection: 'row', gap: 7, marginTop: 8 }, input: { flex: 1, height: 39, minWidth: 0, paddingHorizontal: 10, borderWidth: 1, borderColor: '#2d393e', borderRadius: 8, backgroundColor: '#0d1317', color: '#e8efeb', fontSize: 10 }, smallButton: { height: 39, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3a4a40', alignItems: 'center', justifyContent: 'center', backgroundColor: '#18231c' }, smallButtonText: { color: '#b7e8bc', fontSize: 9, fontWeight: '700' }, progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, progressText: { color: '#a2aeaa', fontSize: 9 }, lockText: { color: '#84918e', fontSize: 7, fontWeight: '800', letterSpacing: 1 }, readyText: { color: '#a2e5a8' }, track: { height: 3, borderRadius: 3, backgroundColor: '#293431', marginTop: 8, marginBottom: 5 }, fill: { height: 3, borderRadius: 3, backgroundColor: '#9be49c' }, checkRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#ffffff0c' }, checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: '#617069', alignItems: 'center', justifyContent: 'center' }, checkboxDone: { borderColor: '#9be49c', backgroundColor: '#9be49c' }, checkMark: { color: '#102016', fontSize: 11, fontWeight: '900' }, itemText: { flex: 1, color: '#e4ebe7', fontSize: 11 }, itemDone: { color: '#829087', textDecorationLine: 'line-through' }, deleteButton: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#778481', fontSize: 18 }, helper: { color: '#84918e', fontSize: 10, lineHeight: 16, marginTop: 12 }, logButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: '#405447', borderRadius: 9, backgroundColor: '#19261e' }, logButtonText: { color: '#b8efbe', fontSize: 11, fontWeight: '800' }, logHint: { color: '#7e8e84', fontSize: 8, marginTop: 3 }, logDisabled: { borderColor: '#303b3b', backgroundColor: '#151d1e' }, logDisabledText: { color: '#73807f' },
  empty: { alignItems: 'center', marginTop: 38, padding: 24, borderWidth: 1, borderColor: '#29353b', borderRadius: 14, backgroundColor: '#11181d' }, plusMark: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: '#526653', alignItems: 'center', justifyContent: 'center', color: '#9be49c', fontSize: 22, marginBottom: 12 }, footer: { color: '#626e70', fontSize: 8, textAlign: 'center', marginTop: 22 }, notice: { position: 'absolute', bottom: 12, left: 15, right: 15, padding: 12, borderRadius: 9, backgroundColor: '#26372a' }, noticeText: { color: '#c3edc7', fontSize: 10 },
  modalBack: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#000b' }, modalCard: { padding: 19, borderRadius: 15, borderWidth: 1, borderColor: '#344149', backgroundColor: '#131b20' }, modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { color: '#9eaaa8', fontSize: 25 }, modalInput: { height: 44, borderWidth: 1, borderColor: '#2d393e', borderRadius: 9, backgroundColor: '#0d1317', paddingHorizontal: 11, color: '#eff3f0', fontSize: 11, marginTop: 10 }, modeRow: { flexDirection: 'row', gap: 7, marginTop: 12, marginBottom: 10 }, modeChip: { flex: 1, alignItems: 'center', padding: 9, borderWidth: 1, borderColor: '#344047', borderRadius: 8 }, modeChipActive: { borderColor: '#618168', backgroundColor: '#1c2d22' }, modeText: { color: '#c0cdc5', fontSize: 8, fontWeight: '700' },
});

