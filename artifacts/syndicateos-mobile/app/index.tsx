import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Btn, Skeleton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage, isUnavailable, useAuth } from '@/lib/session';
import { useWorkspace } from '@/lib/workspace';
import { LoginScreen, ResetGate } from '@/screens/AuthScreens';
import { OwnerFirms } from '@/screens/OwnerFirms';
import { OwnerSectors } from '@/screens/OwnerSectors';
import { SectorWorkspace } from '@/screens/SectorInterface';

type Tab = 'firms' | 'sectors' | 'work';

function Authed() {
  const c = useColors();
  const { account, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const isOwner = account?.role === 'OWNER';
  const [tab, setTab] = useState<Tab>(isOwner ? 'firms' : 'work');
  const q = useWorkspace(true);
  const ws = q.data;

  const tabs: { key: Tab; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = isOwner
    ? [{ key: 'firms', label: 'Firms', icon: 'briefcase' }, { key: 'sectors', label: 'Sectors', icon: 'grid' }]
    : [{ key: 'work', label: account?.role === 'PARTNER' ? 'My projects' : 'Workspace', icon: 'layers' }];

  let body: React.ReactNode;
  if (q.isLoading) body = <Skeleton lines={4} />;
  else if (q.isError || !ws)
    body = (
      <Banner
        tone={isUnavailable(q.error) ? 'warn' : 'error'}
        title={isUnavailable(q.error) ? 'Infrastructure pending' : 'Workspace could not load'}
        text={errMessage(q.error)}
        action={{ label: 'Retry', onPress: () => void q.refetch() }}
      />
    );
  else if (tab === 'firms' && isOwner) body = <OwnerFirms ws={ws} />;
  else if (tab === 'sectors' && isOwner) body = <OwnerSectors ws={ws} />;
  else if (account) body = <SectorWorkspace ws={ws} account={account} />;

  const nav = (
    <View style={wide ? { gap: 6, marginTop: 24 } : { flexDirection: 'row', gap: 6 }}>
      {tabs.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
            <Feather name={t.icon} size={16} color={c.heroForeground} />
            <Text style={{ color: c.heroForeground, fontFamily: 'Inter_600SemiBold' }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const head = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="layers" size={18} color={c.accent} />
        <Text style={{ color: c.heroForeground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>SyndicateOS</Text>
      </View>
      <Text style={{ color: c.heroForeground, opacity: 0.65, fontSize: 12, marginTop: 4 }}>
        {account?.displayName} · {account?.role}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: c.background }}>
      {wide ? (
        <View style={{ width: 240, backgroundColor: c.hero, padding: 20, justifyContent: 'space-between' }}>
          <View>{head}{nav}</View>
          <Btn label="Sign out" variant="ghost" icon="log-out" onPress={() => void signOut()} />
        </View>
      ) : (
        <View style={{ backgroundColor: c.hero, paddingTop: Platform.OS === 'web' ? 24 : insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {head}
            <Pressable onPress={() => void signOut()} accessibilityLabel="Sign out" hitSlop={10}>
              <Feather name="log-out" size={20} color={c.heroForeground} />
            </Pressable>
          </View>
          {tabs.length > 1 ? nav : null}
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 60, maxWidth: 980, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {q.isFetching && !q.isLoading ? <Text style={{ color: c.mutedForeground, fontSize: 11, marginBottom: 6 }}>Refreshing…</Text> : null}
        {body}
      </ScrollView>
    </View>
  );
}

export default function Index() {
  const c = useColors();
  const { phase, account } = useAuth();
  if (phase === 'booting')
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.hero }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  if (phase === 'anon' || !account) return <LoginScreen />;
  if (account.mustChangeCredential) return <ResetGate />;
  return <Authed />;
}
