import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/Brand';
import { Banner, Btn, Skeleton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage, isUnavailable, useAuth } from '@/lib/session';
import { useWorkspace } from '@/lib/workspace';
import { OwnerFirms } from '@/screens/OwnerFirms';
import { OwnerSectors } from '@/screens/OwnerSectors';
import { SectorWorkspace } from '@/screens/SectorInterface';

type Tab = 'firms' | 'sectors' | 'work';

/** mode 'owner' renders management only; 'client' renders only the sector workspace. */
export function WorkspaceShell({ mode }: { mode: 'owner' | 'client' }) {
  const c = useColors();
  const { account, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const owner = mode === 'owner';
  const [tab, setTab] = useState<Tab>(owner ? 'firms' : 'work');
  const q = useWorkspace(true);
  const ws = q.data;

  const tabs: { key: Tab; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = owner
    ? [{ key: 'firms', label: 'Firms', icon: 'briefcase' }, { key: 'sectors', label: 'Sectors', icon: 'grid' }]
    : [{ key: 'work', label: account?.role === 'PARTNER' ? 'My projects' : 'Workspace', icon: 'layers' }];

  let body: React.ReactNode;
  if (q.isLoading) body = <Skeleton lines={4} />;
  else if (q.isError || !ws)
    body = (
      <Banner tone={isUnavailable(q.error) ? 'warn' : 'error'} title={isUnavailable(q.error) ? 'Infrastructure pending' : 'Workspace could not load'} text={errMessage(q.error)} action={{ label: 'Retry', onPress: () => void q.refetch() }} />
    );
  else if (owner && tab === 'firms') body = <OwnerFirms ws={ws} />;
  else if (owner && tab === 'sectors') body = <OwnerSectors ws={ws} />;
  else if (!owner && account) body = <SectorWorkspace ws={ws} account={account} />;

  const firm = !owner ? ws?.firms.find((f) => f.id === account?.firmId) ?? ws?.firms[0] : undefined;
  const company = !owner ? (firm ? `${firm.name} (${firm.clientCode})` : account?.clientCode) : null;
  const nav = (
    <View style={wide ? { gap: 6, marginTop: 24 } : { flexDirection: 'row', gap: 6 }}>
      {tabs.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
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
      <BrandLogo width={wide ? 150 : 116} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <Text numberOfLines={1} style={{ color: c.heroForeground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>{firm ? firm.name : owner ? 'Owner console' : 'Workspace'}</Text>
      </View>
      <Text style={{ color: c.heroForeground, opacity: 0.65, fontSize: 12, marginTop: 4 }}>
        {account?.displayName}{firm ? ` · ${firm.clientCode}` : company ? ` · ${company}` : owner ? ' · Owner' : ''}
      </Text>
    </View>
  );

  if (!owner) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F4F6' }}>
        <View style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8, paddingHorizontal: wide ? 32 : 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexShrink: 1, gap: 6 }}>
            <BrandLogo width={wide ? 150 : 110} />
            <Text numberOfLines={1} style={{ color: '#111827', fontFamily: 'Inter_700Bold', fontSize: wide ? 18 : 15 }}>{firm ? firm.name : 'Workspace'}</Text>
            <Text numberOfLines={1} style={{ color: '#6b7280', fontSize: 12 }}>{account?.displayName} · {account?.role === 'PARTNER' ? 'Partner' : 'Accountant'}{firm ? ` · ${firm.clientCode}` : ''}</Text>
          </View>
          <Pressable onPress={() => void signOut()} accessibilityRole="button" accessibilityLabel="Sign out" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 12, backgroundColor: '#f3f4f6' }}>
            <Feather name="log-out" size={16} color="#111827" />
            {wide ? <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#111827' }}>Sign Out</Text> : null}
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 28 : 12, paddingBottom: 60, maxWidth: 1240, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </View>
    );
  }

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
            <Pressable onPress={() => void signOut()} accessibilityRole="button" accessibilityLabel="Sign out" hitSlop={10}>
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
