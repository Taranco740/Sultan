import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { localDay, SULTAN_AREAS } from '@sultan/shared';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const seed = [
  { id: 'a', title: 'Review today’s trading plan', area: 'trading', done: true },
  { id: 'b', title: 'Complete strength session', area: 'health', done: false },
  { id: 'c', title: 'Ship one meaningful project step', area: 'work', done: false },
];

export default function App() {
  const [area, setArea] = useState('personal');
  const [tasks, setTasks] = useState(seed);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from('focus_items').select('id,title,area,done').eq('user_id', user.id).eq('day', localDay()).order('created_at')
      .then(({ data, error }) => { if (!error) setTasks(data ?? []); });
  }, [user]);
  async function toggle(task) {
    const done = !task.done;
    setTasks(list => list.map(item => item.id === task.id ? { ...item, done } : item));
    if (supabase && user) await supabase.from('focus_items').update({ done }).eq('id', task.id).eq('user_id', user.id);
  }
  async function authenticate() {
    if (!supabase) { setAuthError('Connect Sultan to Supabase to enable your private account.'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    else setAuthOpen(false);
  }
  const chosen = SULTAN_AREAS.find(item => item.id === area);
  const done = tasks.filter(item => item.done).length;
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor="#0b0f14"/><ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><View style={s.mark}><Text style={s.markText}>S</Text></View><View><Text style={s.brand}>Sultan</Text><Text style={s.kicker}>YOUR LIFE, IN RHYTHM</Text></View><TouchableOpacity onPress={()=>user ? supabase?.auth.signOut() : setAuthOpen(true)} style={s.sync}><View style={s.dot}/><Text style={s.syncText}>{user ? 'Account' : isSupabaseConfigured ? 'Sign in' : 'Preview'}</Text></TouchableOpacity></View>
    <Text style={s.date}>{new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(new Date()).toUpperCase()}</Text>
    <Text style={s.title}>{area === 'personal' ? 'Make today\ncount.' : `${chosen.label}\nin rhythm.`}</Text><Text style={s.subtitle}>A clear head. A few meaningful moves.</Text>
    <View style={s.progressCard}><Text style={s.progressLabel}>TODAY’S RHYTHM</Text><Text style={s.progressValue}>{tasks.length ? Math.round(done/tasks.length*100) : 0}<Text style={s.percent}>%</Text></Text><Text style={s.progressSub}>{done} of {tasks.length} steps complete</Text><View style={s.track}><View style={[s.fill,{width:`${tasks.length ? done/tasks.length*100 : 0}%`}]}/></View></View>
    <Text style={s.section}>YOUR AREAS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.areas}>{SULTAN_AREAS.map(item => <TouchableOpacity onPress={()=>setArea(item.id)} key={item.id} style={[s.areaButton,area===item.id&&s.areaActive]}><View style={[s.areaDot,{backgroundColor:item.tint}]}/><Text style={s.areaText}>{item.label}</Text></TouchableOpacity>)}</ScrollView>
    <View style={s.focusHead}><View><Text style={s.section}>DAILY FOCUS</Text><Text style={s.focusTitle}>Keep it simple.</Text></View><TouchableOpacity style={s.add}><Text style={s.addText}>＋</Text></TouchableOpacity></View>
    {tasks.map(task=><TouchableOpacity key={task.id} onPress={()=>toggle(task)} style={s.task}><View style={[s.check,task.done&&s.checked]}>{task.done&&<Text style={s.checkMark}>✓</Text>}</View><View style={s.taskText}><Text style={[s.taskTitle,task.done&&s.completed]}>{task.title}</Text><Text style={s.taskArea}>{SULTAN_AREAS.find(item=>item.id===task.area)?.label}</Text></View><Text style={[s.arrow,{color:SULTAN_AREAS.find(item=>item.id===task.area)?.tint}]}>↗</Text></TouchableOpacity>)}
    <TouchableOpacity style={s.minimum}><Text style={s.star}>✦</Text><View style={{flex:1}}><Text style={s.minimumTitle}>Minimum day</Text><Text style={s.minimumSub}>One small promise is enough.</Text></View><Text style={s.arrow}>↗</Text></TouchableOpacity>
    <Text style={s.foot}>Built for the life you’re creating.  ✦</Text>
    </ScrollView><Modal visible={authOpen} transparent animationType="fade" onRequestClose={()=>setAuthOpen(false)}><View style={s.modalBack}><View style={s.authCard}><TouchableOpacity style={s.close} onPress={()=>setAuthOpen(false)}><Text style={s.closeText}>×</Text></TouchableOpacity><Text style={s.section}>YOUR PRIVATE SPACE</Text><Text style={s.authTitle}>Welcome back.</Text><Text style={s.authSub}>Use your Sultan account to sync with web.</Text><TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#75828a" keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#75828a" secureTextEntry autoComplete="current-password"/>{!!authError&&<Text style={s.authError}>{authError}</Text>}<TouchableOpacity style={s.authButton} onPress={authenticate}><Text style={s.authButtonText}>Sign in  ↗</Text></TouchableOpacity></View></View></Modal></SafeAreaView>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#0b0f14'},page:{paddingHorizontal:21,paddingTop:16,paddingBottom:32},header:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:42},mark:{width:34,height:34,borderRadius:11,backgroundColor:'#4ade80',alignItems:'center',justifyContent:'center'},markText:{color:'#102016',fontSize:19,fontWeight:'900'},brand:{color:'#f0f2f1',fontSize:17,fontWeight:'800',letterSpacing:-.5},kicker:{color:'#68757c',fontSize:7,letterSpacing:1.25,marginTop:2},sync:{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:9,paddingVertical:7,backgroundColor:'#18211d',borderRadius:20},dot:{width:5,height:5,borderRadius:4,backgroundColor:'#4ade80'},syncText:{fontSize:9,color:'#91a097'},date:{fontSize:8,color:'#87958d',letterSpacing:1.7,fontWeight:'700'},title:{fontSize:47,lineHeight:49,color:'#f0f2f0',fontWeight:'700',letterSpacing:-2,marginTop:13},subtitle:{color:'#87939a',fontSize:11,marginTop:12},progressCard:{marginTop:27,padding:17,borderRadius:14,borderColor:'#293730',borderWidth:1,backgroundColor:'#141d1a'},progressLabel:{textAlign:'center',fontSize:8,color:'#829087',letterSpacing:1.5},progressValue:{textAlign:'center',fontSize:43,fontWeight:'500',color:'#edf1ed',marginTop:6},percent:{fontSize:16,color:'#a8b5ad'},progressSub:{textAlign:'center',fontSize:9,color:'#87948c',marginTop:0},track:{height:3,backgroundColor:'#26312b',borderRadius:4,marginTop:17},fill:{height:3,backgroundColor:'#4ade80',borderRadius:4},section:{fontSize:8,color:'#809088',letterSpacing:1.4,fontWeight:'700'},areas:{gap:8,paddingVertical:12},areaButton:{height:37,paddingHorizontal:11,borderRadius:8,borderWidth:1,borderColor:'#222d33',backgroundColor:'#12181d',flexDirection:'row',alignItems:'center',gap:7},areaActive:{borderColor:'#32453a',backgroundColor:'#18211d'},areaDot:{width:6,height:6,borderRadius:4},areaText:{fontSize:9,color:'#aeb8bb'},focusHead:{marginTop:20,marginBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},focusTitle:{fontSize:20,color:'#e8edea',fontWeight:'600',marginTop:6},add:{width:29,height:29,borderRadius:8,borderWidth:1,borderColor:'#314236',alignItems:'center',justifyContent:'center',backgroundColor:'#172019'},addText:{color:'#8de4a9',fontSize:18},task:{minHeight:62,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:'#20292e',gap:11},check:{width:17,height:17,borderRadius:5,borderWidth:1,borderColor:'#4b575d',alignItems:'center',justifyContent:'center'},checked:{backgroundColor:'#4ade80',borderColor:'#4ade80'},checkMark:{fontSize:10,fontWeight:'800',color:'#102016'},taskText:{flex:1},taskTitle:{fontSize:11,color:'#d8e0e1'},completed:{color:'#7b8880',textDecorationLine:'line-through'},taskArea:{fontSize:8,color:'#79868d',marginTop:5},arrow:{fontSize:12,color:'#8ab99a'},minimum:{marginTop:14,padding:12,borderRadius:9,borderWidth:1,borderColor:'#2c332c',backgroundColor:'#171e1d',flexDirection:'row',alignItems:'center',gap:10},star:{color:'#dbbe68',fontSize:14},minimumTitle:{fontSize:9,color:'#dedbc6',fontWeight:'600'},minimumSub:{fontSize:8,color:'#918b75',marginTop:3},foot:{textAlign:'center',fontSize:8,color:'#58656b',marginTop:24},modalBack:{flex:1,backgroundColor:'#020507cc',justifyContent:'center',padding:20},authCard:{backgroundColor:'#141c22',borderRadius:16,borderWidth:1,borderColor:'#344047',padding:23},close:{position:'absolute',right:13,top:10,zIndex:2},closeText:{fontSize:24,color:'#8a969d'},authTitle:{fontSize:25,color:'#edf1ef',fontWeight:'600',marginTop:9},authSub:{fontSize:10,color:'#87939a',marginTop:7,marginBottom:16},input:{backgroundColor:'#0e1419',borderWidth:1,borderColor:'#35414a',borderRadius:8,padding:12,color:'#e9eeee',fontSize:11,marginBottom:10},authError:{fontSize:9,color:'#f6c879',marginBottom:9},authButton:{height:42,backgroundColor:'#4ade80',borderRadius:8,alignItems:'center',justifyContent:'center',marginTop:3},authButtonText:{fontSize:11,color:'#102016',fontWeight:'700'}});
