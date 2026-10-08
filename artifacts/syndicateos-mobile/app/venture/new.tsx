import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { tapHaptic } from '@/components/Shared';
import { SectorId, SECTORS, useSyndicate } from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

export default function NewVentureScreen() {
  const colors = useColors();
  const { enabledSectors, addVenture } = useSyndicate();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [commitment, setCommitment] = useState('');
  const [sector, setSector] = useState<SectorId | null>(
    enabledSectors[0] ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const availableSectors = useMemo(
    () => SECTORS.filter((item) => enabledSectors.includes(item.id)),
    [enabledSectors],
  );

  async function saveVenture() {
    const cleanName = name.trim();
    const cleanLocation = location.trim();
    const amount = commitment.trim() ? Number(commitment.replaceAll(',', '')) : 0;
    if (!cleanName) {
      setFormError('Enter a name for this venture.');
      return;
    }
    if (!cleanLocation) {
      setFormError('Enter the city and state for this venture.');
      return;
    }
    if (!sector || !enabledSectors.includes(sector)) {
      setFormError('Choose an enabled sector package for this client.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Enter a non-negative amount in rupees.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await addVenture({
        name: cleanName,
        location: cleanLocation,
        sector,
        committed: amount,
      });
      await tapHaptic();
      router.back();
    } catch {
      setFormError(
        'Could not save this demo venture. Local storage did not accept the change.',
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
    },
  ];

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.formContent,
        { paddingTop: 24, paddingBottom: 40 },
      ]}
      bottomOffset={72}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.modalHeader}>
        <View style={styles.modalCopy}>
          <Text style={[styles.modalKicker, { color: colors.primary }]}>
            SAMPLE CLIENT WORKSPACE
          </Text>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Create a venture
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
            Set up the shared record before adding sector operations.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close form"
          testID="close-new-venture"
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="x" size={19} color={colors.foreground} />
        </Pressable>
      </View>
      {formError ? (
        <View style={[styles.formError, { backgroundColor: colors.warningSurface }]}>
          <Feather name="alert-circle" size={15} color={colors.warning} />
          <Text style={[styles.formErrorText, { color: colors.warning }]}>
            {formError}
          </Text>
        </View>
      ) : null}

      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
          Venture name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Lakeview Layout"
          placeholderTextColor={colors.mutedForeground}
          style={inputStyle}
          autoCapitalize="words"
          returnKeyType="next"
          testID="venture-name-input"
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
          City and state
        </Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Hyderabad, Telangana"
          placeholderTextColor={colors.mutedForeground}
          style={inputStyle}
          autoCapitalize="words"
          returnKeyType="next"
          testID="venture-location-input"
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
          Sector workflow
        </Text>
        {availableSectors.length ? (
          <View style={styles.sectorChoices}>
            {availableSectors.map((item) => {
              const selected = sector === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSector(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  testID={`venture-sector-${item.id}`}
                  style={({ pressed }) => [
                    styles.sectorChoice,
                    {
                      backgroundColor: selected ? colors.successSurface : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectorChoiceText,
                      { color: selected ? colors.primary : colors.foreground },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {selected ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.noSector, { backgroundColor: colors.warningSurface }]}>
            <Text style={[styles.noSectorText, { color: colors.warning }]}>
              No sector is assigned to this client. Enable one from Modules first.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
          Capital commitment
          <Text style={[styles.optionalLabel, { color: colors.mutedForeground }]}>
            {' '}
            · optional, in rupees
          </Text>
        </Text>
        <View
          style={[
            styles.amountInputWrap,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rupeePrefix, { color: colors.mutedForeground }]}>₹</Text>
          <TextInput
            value={commitment}
            onChangeText={(value) => setCommitment(value.replace(/[^\d,]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.amountInput, { color: colors.foreground }]}
            keyboardType="number-pad"
            returnKeyType="done"
            testID="venture-commitment-input"
          />
        </View>
      </View>

      <View style={[styles.localNote, { backgroundColor: colors.secondary }]}>
        <Feather name="info" size={15} color={colors.primary} />
        <Text style={[styles.localNoteText, { color: colors.secondaryForeground }]}>
          This creates a local demo record. No account, ledger, or live server record is created yet.
        </Text>
      </View>

      <Pressable
        onPress={() => void saveVenture()}
        disabled={saving || availableSectors.length === 0}
        accessibilityRole="button"
        testID="save-new-venture"
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: colors.primary,
            opacity:
              saving || availableSectors.length === 0
                ? 0.55
                : pressed
                  ? 0.82
                  : 1,
          },
        ]}
      >
        <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
          {saving ? 'Saving…' : 'Save demo venture'}
        </Text>
        <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  formContent: {
    paddingHorizontal: 22,
    gap: 19,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 3,
  },
  modalCopy: {
    flex: 1,
    gap: 6,
  },
  modalKicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.9,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
    letterSpacing: -0.6,
  },
  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
  },
  closeButton: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  formError: {
    borderRadius: 13,
    padding: 11,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  formErrorText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 15,
  },
  optionalLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  sectorChoices: {
    gap: 8,
  },
  sectorChoice: {
    minHeight: 45,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectorChoiceText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    flex: 1,
  },
  noSector: {
    padding: 13,
    borderRadius: 14,
  },
  noSectorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 17,
  },
  amountInputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rupeePrefix: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  localNote: {
    borderRadius: 15,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  localNoteText: {
    fontFamily: 'Inter_400Regular',
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 1,
  },
  saveButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
});
