import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  changeCredential,
  getMe,
  login,
  useReadinessCheck,
  type LoginInput,
} from '@workspace/api-client-react';
import { Banner, Btn, Card, Chips, Field } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage, httpStatus, isUnavailable, reportError, useAuth } from '@/lib/session';

const ROLES: { value: LoginInput['role']; label: string }[] = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'PARTNER', label: 'Partner' },
];

function Frame({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.hero }}
      contentContainerStyle={st.frame}
      keyboardShouldPersistTaps="handled"
    >
      <View style={st.brand}>
        <Feather name="layers" size={22} color={c.accent} />
        <Text style={{ color: c.heroForeground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>SyndicateOS</Text>
      </View>
      <View style={{ width: '100%', maxWidth: 440 }}>{children}</View>
    </ScrollView>
  );
}

export function LoginScreen() {
  const c = useColors();
  const { signIn, bootError, retryBoot } = useAuth();
  const [role, setRole] = useState<LoginInput['role']>('OWNER');
  const [mobile, setMobile] = useState('');
  const [credential, setCredential] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; infra: boolean } | null>(null);
  const ready = useReadinessCheck({ query: { queryKey: ['readyz'], retry: false, refetchInterval: 30000 } });

  const submit = async () => {
    if (!mobile.trim() || !credential) return setError({ text: 'Enter your mobile and credential.', infra: false });
    if (role === 'ACCOUNTANT' && !clientCode.trim()) return setError({ text: 'Accountants must enter the firm client code.', infra: false });
    setBusy(true);
    setError(null);
    try {
      const input: LoginInput = { role, mobile: mobile.trim(), credential };
      if (role === 'ACCOUNTANT') input.clientCode = clientCode.trim();
      const res = await login(input);
      setCredential('');
      await signIn(res);
    } catch (e) {
      setError({ text: errMessage(e), infra: isUnavailable(e) });
    } finally {
      setBusy(false);
    }
  };

  const infraDown = ready.isError;
  return (
    <Frame>
      <Text style={{ color: c.heroForeground, fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, marginBottom: 6 }}>
        One workspace. A different interface for every sector.
      </Text>
      <Text style={{ color: c.heroForeground, opacity: 0.7, marginBottom: 22, lineHeight: 20 }}>
        Sign in with your trusted role. Screens and forms come from your firm's assigned sector configuration.
      </Text>
      <Card>
        {infraDown ? (
          <Banner
            tone="warn"
            title="Infrastructure pending"
            text="The SyndicateOS database is not reachable yet, so sign-in is unavailable. No data is shown until it is connected."
            action={{ label: 'Check again', onPress: () => void ready.refetch() }}
          />
        ) : null}
        {bootError ? (
          <Banner tone="warn" title="Could not restore your session" text={bootError} action={{ label: 'Retry', onPress: retryBoot }} />
        ) : null}
        <Chips label="Sign in as" options={ROLES} value={role} onChange={setRole} />
        <Field label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" testID="input-mobile" />
        {role === 'ACCOUNTANT' ? (
          <Field label="Firm client code" value={clientCode} onChangeText={setClientCode} testID="input-client-code" />
        ) : null}
        <Field label="Credential" value={credential} onChangeText={setCredential} secure testID="input-credential" />
        {error ? (
          <Banner
            tone={error.infra ? 'warn' : 'error'}
            title={error.infra ? 'Infrastructure pending' : 'Sign-in failed'}
            text={error.text}
          />
        ) : null}
        <Btn label="Sign in" icon="log-in" onPress={submit} loading={busy} testID="button-login" />
      </Card>
    </Frame>
  );
}

export function ResetGate() {
  const { account, signIn, signOut } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (next.length < 8) return setError('New credential must be at least 8 characters.');
    if (next !== again) return setError('The new credentials do not match.');
    if (next === cur) return setError('Choose a credential different from the current one.');
    setBusy(true);
    setError(null);
    try {
      const res = await changeCredential({ currentCredential: cur, newCredential: next });
      setCur('');
      setNext('');
      setAgain('');
      await signIn(res);
    } catch (e) {
      setError(errMessage(e));
      if (httpStatus(e) === 401) {
        // Wrong current credential also returns 401; only end the session if the token itself is dead.
        try {
          await getMe();
        } catch (me) {
          reportError(me);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Card>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>Set a private credential</Text>
        <Text style={{ fontSize: 13, lineHeight: 19, marginBottom: 14, opacity: 0.7 }}>
          {account?.displayName}, your account uses a temporary credential. Nothing in the workspace opens until you replace it.
        </Text>
        <Field label="Current (temporary) credential" value={cur} onChangeText={setCur} secure />
        <Field label="New credential" value={next} onChangeText={setNext} secure hint="At least 8 characters." />
        <Field label="Repeat new credential" value={again} onChangeText={setAgain} secure />
        {error ? <Banner tone="error" title="Could not update" text={error} /> : null}
        <View style={{ gap: 8 }}>
          <Btn label="Save and continue" onPress={submit} loading={busy} />
          <Btn label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </Card>
    </Frame>
  );
}

const st = StyleSheet.create({
  frame: { flexGrow: 1, padding: 22, justifyContent: 'center', alignItems: 'center', gap: 26 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
});
