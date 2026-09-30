import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { DashboardArea } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from './lib/supabase';

type AuthMode = 'sign-in' | 'sign-up';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [area, setArea] = useState<DashboardArea>('trading');
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function authenticate() {
    if (!supabase) {
      setError('Set the Supabase URL and publishable key in the app environment to enable accounts.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const result = authMode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (authMode === 'sign-up' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#090d11" />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topbar}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View>
          <View><Text style={styles.brand}>TradeOS</Text><Text style={styles.caption}>DISCIPLINE, MADE VISIBLE</Text></View>
          {session ? <TouchableOpacity onPress={() => void supabase?.auth.signOut()}><Text style={styles.link}>Sign out</Text></TouchableOpacity> : null}
        </View>

        {session ? (
          <View style={styles.dashboard}>
            <Text style={styles.overline}>YOUR WORKSPACE</Text>
            <Text style={styles.title}>{area === 'trading' ? 'Trade with intention.' : 'Build a steady day.'}</Text>
            <Text style={styles.subtitle}>A calm place to follow your own process and record what happened.</Text>
            <View style={styles.switcher}>
              {(['trading', 'personal'] as const).map((item) => (
                <TouchableOpacity key={item} style={[styles.switchOption, area === item && styles.switchSelected]} onPress={() => setArea(item)}>
                  <Text style={[styles.switchText, area === item && styles.switchTextSelected]}>{item === 'trading' ? 'Trading' : 'Personal'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>{area === 'trading' ? 'TRADING DESK' : 'PERSONAL SPACE'}</Text>
              <Text style={styles.cardTitle}>{area === 'trading' ? 'Your rules. Your journal.' : 'Make space for the rest.'}</Text>
              <Text style={styles.cardCopy}>{area === 'trading' ? 'Start with your strategy and a deliberate pre-trade pause.' : 'Daily focus and life-area check-ins will live here.'}</Text>
              <View style={styles.pulse}><View style={styles.pulseDot} /><Text style={styles.pulseText}>Workspace ready</Text></View>
            </View>
            <Text style={styles.signedIn}>Signed in as {session.user.email}</Text>
          </View>
        ) : (
          <View style={styles.auth}>
            <Text style={styles.overline}>YOUR PRIVATE WORKSPACE</Text>
            <Text style={styles.title}>Welcome to TradeOS.</Text>
            <Text style={styles.subtitle}>Sign in or create your account to keep your workspace synced across devices.</Text>
            <View style={styles.form}>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#76828b" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#76828b" secureTextEntry autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}
              {!isSupabaseConfigured ? <Text style={styles.hint}>Supabase credentials are not configured yet.</Text> : null}
              <TouchableOpacity style={styles.primary} onPress={() => void authenticate()} disabled={busy}>
                {busy ? <ActivityIndicator color="#0d1810" /> : <Text style={styles.primaryText}>{authMode === 'sign-in' ? 'Sign in' : 'Create account'}  ↗</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage(''); }}>
                <Text style={styles.toggle}>{authMode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <Text style={styles.footer}>No broker passwords. No trade signals. Just your process.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#090d11' },
  page: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9be49c' },
  brandMarkText: { color: '#102016', fontSize: 20, fontWeight: '900' },
  brand: { color: '#f3f5f4', fontSize: 16, fontWeight: '800' },
  caption: { color: '#6c797f', fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  link: { color: '#9be49c', fontSize: 12, marginLeft: 'auto', padding: 10 },
  dashboard: { flex: 1, justifyContent: 'center' },
  auth: { flex: 1, justifyContent: 'center', maxWidth: 460, width: '100%', alignSelf: 'center' },
  overline: { color: '#9be49c', fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 12 },
  title: { color: '#f1f3f2', fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { color: '#9aa5aa', fontSize: 13, lineHeight: 20, marginTop: 12 },
  form: { gap: 11, marginTop: 25 },
  input: { height: 50, paddingHorizontal: 14, color: '#e9eeee', backgroundColor: '#12191e', borderColor: '#27343c', borderWidth: 1, borderRadius: 12, fontSize: 14 },
  primary: { height: 50, borderRadius: 12, backgroundColor: '#9be49c', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#102016', fontSize: 14, fontWeight: '800' },
  toggle: { color: '#b7c5bd', textAlign: 'center', fontSize: 12, paddingVertical: 10 },
  error: { color: '#ffaaa1', fontSize: 12 },
  message: { color: '#9be49c', fontSize: 12 },
  hint: { color: '#9aa5aa', fontSize: 11 },
  switcher: { flexDirection: 'row', backgroundColor: '#12191e', borderRadius: 12, padding: 4, marginTop: 28 },
  switchOption: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  switchSelected: { backgroundColor: '#24352a' },
  switchText: { color: '#9aa5aa', fontSize: 13, fontWeight: '600' },
  switchTextSelected: { color: '#b7f0b9' },
  card: { padding: 20, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#29373b', backgroundColor: '#12191e' },
  cardEyebrow: { color: '#9be49c', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  cardTitle: { color: '#edf1ef', fontSize: 19, fontWeight: '700', marginTop: 14 },
  cardCopy: { color: '#9aa5aa', fontSize: 12, lineHeight: 18, marginTop: 8 },
  pulse: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  pulseDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#9be49c' },
  pulseText: { color: '#bdc9c1', fontSize: 11 },
  signedIn: { color: '#6f7c80', fontSize: 10, textAlign: 'center', marginTop: 20 },
  footer: { color: '#637078', fontSize: 10, textAlign: 'center' },
});

