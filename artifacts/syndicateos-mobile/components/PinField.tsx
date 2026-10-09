import React, { useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

/** Keep ASCII 0-9 only, at most six. */
export function sanitizePin(v: string) {
  return v.replace(/[^0-9]/g, '').slice(0, 6);
}

/** One secure input drives six visible cells showing a dash, or a dot per entered digit. */
export function PinField({
  label,
  value,
  onChangeText,
  onSubmit,
  error,
  hint,
  autoFocus,
  editable = true,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit?: () => void;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
}) {
  const c = useColors();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, 5);
  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => ref.current?.focus()}
        disabled={!editable}
        accessible={false}
        style={{ position: 'relative' }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          {Array.from({ length: 6 }).map((_, i) => {
            const on = focused && i === active;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: on ? 2 : 1,
                  borderColor: error ? c.destructive : on ? c.primary : c.input,
                  backgroundColor: editable ? c.card : c.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: i < value.length ? c.foreground : c.mutedForeground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>
                  {i < value.length ? '\u25CF' : '\u2013'}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={`${label}, six digits, ${value.length} entered`}
          value={value}
          onChangeText={(v) => onChangeText(sanitizePin(v))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          secureTextEntry
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={6}
          editable={editable}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect={false}
          autoCapitalize="none"
          textContentType="password"
          returnKeyType={onSubmit ? 'go' : undefined}
          caretHidden
          selectionColor="transparent"
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
            Platform.OS === 'web' ? ({ cursor: 'text' } as object) : null,
          ]}
        />
      </Pressable>
      {error ? <Text style={{ color: c.destructive, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
      {hint && !error ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 4, lineHeight: 16 }}>{hint}</Text> : null}
    </View>
  );
}
