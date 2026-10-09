import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Btn } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/lib/session';
import { OwnerLoginScreen, ResetGate } from '@/screens/AuthScreens';
import { WorkspaceShell } from '@/screens/WorkspaceShell';

function Notice({ text, signOut }: { text: string; signOut?: () => void }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.hero, padding: 24, gap: 14 }}>
      <Text style={{ color: c.heroForeground, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', maxWidth: 420 }}>{text}</Text>
      {signOut ? <Btn label="Sign out" variant="ghost" icon="log-out" onPress={signOut} /> : null}
    </View>
  );
}

export default function OwnerRoute() {
  const c = useColors();
  const { phase, account, signOut, portal } = useAuth();
  if (Platform.OS !== 'web') return <Notice text="Owner management is available on the web only." />;
  if (phase === 'booting')
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.hero }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  if (phase === 'anon' || !account) return <OwnerLoginScreen />;
  if (account.role !== 'OWNER' || portal !== 'owner')
    return <Notice text="This session is not an owner session." signOut={() => void signOut()} />;
  if (account.mustChangeCredential) return <ResetGate />;
  return <WorkspaceShell mode="owner" />;
}
