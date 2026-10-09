import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { changeCredential, getMe, login, useReadinessCheck, type LoginInput } from '@workspace/api-client-react';
import { Banner, Btn, Card, Field } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage, httpStatus, isUnavailable, reportError, useAuth } from '@/lib/session';

function utf8Len(v: string) {
  let n = 0;
  for (const ch of v) {
    const p = ch.codePointAt(0) ?? 0;
    n += p < 0x80 ? 1 : p < 0x800 ? 2 : p < 0x10000 ? 3 : 4;
  }
  return n;
}

function Frame({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.hero }} contentContainerStyle={st.frame} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <View style={st.brand}>
        <View style={[st.mark, { backgroundColor: c.accent }]}>
          <Feather name="layers" size={18} color={c.accentForeground} />
        </View>
        <Text style={{ color: c.heroForeground, fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 }}>SyndicateOS</Text>
      </View>
      <View style={{ width: '100%', maxWidth: 440 }}>{children}</View>
    </ScrollView>
  );
}

function Notices({ error }: { error: { text: string; infra: boolean } | null }) {
  const { bootError, retryBoot } = useAuth();
  const ready = useReadinessCheck({ query: { queryKey: ['readyz'], retry: false, refetchInterval: 30000 } });
  return (
    <>
      {ready.isError ? (
        <Banner tone="warn" title="Infrastructure pending" text="The SyndicateOS database is not reachable yet, so sign-in is unavailable." action={{ label: 'Check again', onPress: () => void ready.refetch() }} />
      ) : null}
      {bootError ? <Banner tone="warn" title="Could not restore your session" text={bootError} action={{ label: 'Retry', onPress: retryBoot }} /> : null}
      {error ? <Banner tone={error.infra ? 'warn' : 'error'} title={error.infra ? 'Infrastructure pending' : 'Sign-in failed'} text={error.text} /> : null}
    </>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  const c = useColors();
  return (
    <>
      <Text style={{ color: c.heroForeground, fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, marginBottom: 6 }}>{title}</Text>
      <Text style={{ color: c.heroForeground, opacity: 0.7, marginBottom: 22, lineHeight: 20 }}>{text}</Text>
    </>
  );
}

/** Client entry: step 1 company code, step 2 mobile + credential. */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [clientCode, setClientCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [credential, setCredential] = useState('');
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; infra: boolean } | null>(null);
  const code = clientCode.trim();

  const next = () => {
    if (!code) return setCodeErr('Enter your company code.');
    if (code.length > 32) return setCodeErr('Company codes are at most 32 characters.');
    setCodeErr(null);
    setError(null);
    setStep(2);
  };

  const submit = async () => {
    if (busy) return;
    if (!mobile.trim() || !credential) return setError({ text: 'Enter your mobile number and PIN or password.', infra: false });
    if (credential.length > 72) return setError({ text: 'PIN or password is too long.', infra: false });
    setBusy(true);
    setError(null);
    try {
      const input: LoginInput = { role: 'CLIENT', clientCode: code, mobile: mobile.trim(), credential };
      const res = await login(input);
      setCredential('');
      await signIn(res);
    } catch (e) {
      setError({ text: errMessage(e), infra: isUnavailable(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      {step === 1 ? (
        <>
          <Heading title="Enter your company workspace" text="Use the company code your firm gave you. Your workspace opens with the screens set up for your sector." />
          <Card>
            <Notices error={null} />
            <Field label="Company code" value={clientCode} onChangeText={(v) => { setClientCode(v); setCodeErr(null); }} error={codeErr} onSubmit={next} autoFocus testID="input-client-code" />
            <Btn label="Next" icon="arrow-right" onPress={next} testID="button-next" />
          </Card>
        </>
      ) : (
        <>
          <Heading title="Welcome" text={`Signing in to company ${code}.`} />
          <Card>
            <Notices error={error} />
            <Field label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" autoFocus testID="input-mobile" />
            <Field label="PIN or password" value={credential} onChangeText={setCredential} secure onSubmit={() => void submit()} testID="input-credential" />
            <View style={{ gap: 8 }}>
              <Btn label={busy ? 'Signing in' : 'Sign in'} icon="log-in" onPress={() => void submit()} loading={busy} testID="button-login" />
              <Btn label="Change company" icon="arrow-left" variant="ghost" disabled={busy} onPress={() => { setStep(1); setCredential(''); setError(null); }} testID="button-back" />
            </View>
          </Card>
        </>
      )}
    </Frame>
  );
}

/** Separate owner entry; no company code. */
export function OwnerLoginScreen() {
  const { signIn } = useAuth();
  const [mobile, setMobile] = useState('');
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; infra: boolean } | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!mobile.trim() || !credential) return setError({ text: 'Enter your mobile number and credential.', infra: false });
    setBusy(true);
    setError(null);
    try {
      const res = await login({ role: 'OWNER', mobile: mobile.trim(), credential });
      setCredential('');
      await signIn(res);
    } catch (e) {
      setError({ text: errMessage(e), infra: isUnavailable(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Heading title="Owner management" text="Firms, sectors and configuration releases." />
      <Card>
        <Notices error={error} />
        <Field label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" autoFocus testID="input-mobile" />
        <Field label="Credential" value={credential} onChangeText={setCredential} secure onSubmit={() => void submit()} testID="input-credential" />
        <Btn label={busy ? 'Signing in' : 'Sign in'} icon="log-in" onPress={() => void submit()} loading={busy} testID="button-login" />
      </Card>
    </Frame>
  );
}

export function ResetGate() {
  const c = useColors();
  const { account, signIn, signOut } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!cur) return setError('Enter your current credential.');
    if (next.length < 8) return setError('New credential must be at least 8 characters.');
    if (utf8Len(next) > 72) return setError('New credential must be at most 72 bytes.');
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
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4, color: c.foreground }}>Set a private credential</Text>
        <Text style={{ fontSize: 13, lineHeight: 19, marginBottom: 14, color: c.mutedForeground }}>
          {account?.displayName}, your account uses a temporary credential. Nothing in the workspace opens until you replace it.
        </Text>
        <Field label="Current (temporary) credential" value={cur} onChangeText={setCur} secure />
        <Field label="New credential" value={next} onChangeText={setNext} secure hint="At least 8 characters." />
        <Field label="Repeat new credential" value={again} onChangeText={setAgain} secure onSubmit={() => void submit()} />
        {error ? <Banner tone="error" title="Could not update" text={error} /> : null}
        <View style={{ gap: 8 }}>
          <Btn label="Save and continue" onPress={() => void submit()} loading={busy} />
          <Btn label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </Card>
    </Frame>
  );
}

const st = StyleSheet.create({
  frame: { flexGrow: 1, padding: 20, paddingVertical: 40, justifyContent: 'center', alignItems: 'center', gap: 26 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  mark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
