import { Feather } from '@expo/vector-icons';
import React, { PropsWithChildren, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Feather>['name'];

export function H1({ children, sub }: PropsWithChildren<{ sub?: string }>) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.h1, { color: c.foreground }]}>{children}</Text>
      {sub ? <Text style={[s.sub, { color: c.mutedForeground }]}>{sub}</Text> : null}
    </View>
  );
}

export function Label({ children }: PropsWithChildren) {
  const c = useColors();
  return <Text style={[s.label, { color: c.mutedForeground }]}>{children}</Text>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const c = useColors();
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }, style]}>
      {children}
    </View>
  );
}

export function Btn({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  testID?: string;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? '#FFB800' : variant === 'danger' ? c.destructive : 'transparent';
  const fg = variant === 'primary' ? '#111827' : variant === 'ghost' ? c.primary : c.primaryForeground;
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? c.border : bg,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Feather name={icon} size={15} color={fg} />
      ) : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  hint,
  error,
  secure,
  multiline,
  keyboardType,
  placeholder,
  editable = true,
  mono,
  height,
  testID,
  onSubmit,
  autoFocus,
}: {
  onSubmit?: () => void;
  autoFocus?: boolean;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  error?: string | null;
  secure?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'numeric';
  placeholder?: string;
  editable?: boolean;
  mono?: boolean;
  height?: number;
  testID?: string;
}) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        returnKeyType={onSubmit ? 'go' : undefined}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        multiline={multiline}
        editable={editable}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          s.input,
          {
            color: c.foreground,
            borderColor: error ? c.destructive : c.input,
            backgroundColor: editable ? c.card : c.muted,
            borderRadius: 12,
          },
          multiline && { height: height ?? 160, textAlignVertical: 'top' },
          mono && { fontFamily: 'Courier', fontSize: 12.5 },
        ]}
      />
      {error ? <Text style={[s.hint, { color: c.destructive }]}>{error}</Text> : null}
      {hint && !error ? <Text style={[s.hint, { color: c.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
  label?: string;
}) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Label>{label}</Label> : null}
      <View style={s.wrap}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              onPress={() => onChange(o.value)}
              style={[
                s.chip,
                { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.card },
              ]}
            >
              <Text style={{ color: on ? c.primaryForeground : c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Badge({ text, tone = 'muted' }: { text: string; tone?: 'ok' | 'warn' | 'muted' | 'bad' }) {
  const c = useColors();
  const map = {
    ok: [c.successSurface, c.success],
    warn: [c.warningSurface, c.warning],
    muted: [c.muted, c.mutedForeground],
    bad: [c.destructive, c.destructiveForeground],
  } as const;
  return (
    <View style={[s.badge, { backgroundColor: map[tone][0] }]}>
      <Text style={{ color: map[tone][1], fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{text}</Text>
    </View>
  );
}

export function Banner({
  tone,
  title,
  text,
  action,
}: {
  tone: 'error' | 'warn' | 'ok';
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  const bg = tone === 'error' ? c.destructive : tone === 'warn' ? c.warningSurface : c.successSurface;
  const fg = tone === 'error' ? c.destructiveForeground : tone === 'warn' ? c.warning : c.success;
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{title}</Text>
      {text ? <Text style={{ color: fg, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{text}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} style={{ marginTop: 8 }}>
          <Text style={{ color: fg, fontFamily: 'Inter_700Bold', fontSize: 13, textDecorationLine: 'underline' }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  const c = useColors();
  return (
    <View style={[s.empty, { borderColor: c.border }]}>
      <Feather name={icon} size={22} color={c.mutedForeground} />
      <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 8 }}>{title}</Text>
      {text ? (
        <Text style={{ color: c.mutedForeground, fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 360 }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ height: 64, borderRadius: 14, backgroundColor: c.muted, opacity: 1 - i * 0.2 }} />
      ))}
    </View>
  );
}

export function Sheet({
  visible,
  title,
  children,
  onClose,
}: PropsWithChildren<{ visible: boolean; title: string; onClose?: () => void }>) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={[s.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.h2, { color: c.foreground }]}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function Confirm({
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = useColors();
  return (
    <Sheet visible title={title} onClose={onCancel}>
      <Text style={{ color: c.mutedForeground, lineHeight: 20, marginBottom: 16 }}>{text}</Text>
      <View style={s.row}>
        <Btn label="Cancel" variant="ghost" onPress={onCancel} />
        <Btn label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} />
      </View>
    </Sheet>
  );
}

/** One-time credential display. Held only in component state; dismissed only by explicit acknowledgement. */
export function CredentialSheet({
  access,
  onDone,
}: {
  access: { mobile: string; reused: boolean; temporaryCredential?: string; expiresAt?: string } | null;
  onDone: () => void;
}) {
  const c = useColors();
  const [ack, setAck] = useState(false);
  if (!access) return null;
  return (
    <Sheet visible title={access.reused ? 'Existing login retained' : 'Temporary PIN'}>
      <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>Mobile {access.mobile}</Text>
      {access.reused || !access.temporaryCredential ? (
        <Text style={{ color: c.foreground, lineHeight: 20, marginBottom: 14 }}>
          This mobile already has a SyndicateOS identity. Their existing credential is unchanged and no new credential was issued.
        </Text>
      ) : (
        <>
          <View style={[s.secret, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Text selectable style={{ color: c.foreground, fontFamily: 'Courier', fontSize: 18, letterSpacing: 1 }}>
              {access.temporaryCredential}
            </Text>
          </View>
          <Text style={{ color: c.warning, fontSize: 13, lineHeight: 18, marginVertical: 10 }}>
            Shown once. It is not stored and cannot be retrieved again. Share this six-digit PIN privately; the user must set their own six-digit PIN at first login.
            {access.expiresAt ? ` Expires ${new Date(access.expiresAt).toLocaleString()}.` : ''}
          </Text>
          <Pressable onPress={() => setAck(!ack)} style={[s.row, { marginBottom: 14, justifyContent: 'flex-start' }]}>
            <Feather name={ack ? 'check-square' : 'square'} size={20} color={c.primary} />
            <Text style={{ color: c.foreground, flex: 1 }}>I have copied this PIN and understand it will not be shown again.</Text>
          </Pressable>
        </>
      )}
      <Btn
        label="Done"
        disabled={!access.reused && !!access.temporaryCredential && !ack}
        onPress={() => {
          setAck(false);
          onDone();
        }}
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  h2: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  sub: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 6, letterSpacing: 0.3 },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  banner: { padding: 14, borderRadius: 14, marginBottom: 14 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 28, alignItems: 'center', marginBottom: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(16,26,22,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 460, borderRadius: 20, borderWidth: 1, padding: 20 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' },
  secret: { borderWidth: 1, borderRadius: 12, padding: 14 },
});

/** Compact native dropdown: a field-like trigger that opens a bottom sheet of options. */
export function Select<T extends string>({
  options, value, onChange, label, compact, testID,
}: {
  options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void; label?: string; compact?: boolean; testID?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: compact ? 0 : 10, flexGrow: 1, flexBasis: compact ? 0 : undefined, minWidth: compact ? 0 : undefined }}>
      {label && !compact ? <Label>{label}</Label> : null}
      <Pressable testID={testID} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label ?? 'Select'}: ${cur?.label ?? 'none'}`}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
        <View style={{ flex: 1 }}>
          {compact && label ? <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 }}>{label.toUpperCase()}</Text> : null}
          <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{cur?.label ?? 'Select'}</Text>
        </View>
        <Feather name="chevron-down" size={16} color={c.mutedForeground} />
      </Pressable>
      <Sheet visible={open} title={label ?? 'Select'} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable key={o.value} onPress={() => { setOpen(false); onChange(o.value); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.border }}>
                <Text style={{ color: c.foreground, fontFamily: on ? 'Inter_700Bold' : 'Inter_400Regular', flex: 1 }}>{o.label}</Text>
                {on ? <Feather name="check" size={16} color={c.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Btn label="Close" variant="ghost" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}
