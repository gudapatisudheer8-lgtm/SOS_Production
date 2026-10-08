import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PageHeader,
  PageScroll,
  SectorMark,
  StorageNotice,
} from '@/components/Shared';
import { SectorId, SECTORS, useSyndicate } from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

export default function ModulesScreen() {
  const colors = useColors();
  const {
    enabledSectors,
    setSectorEnabled,
    ventures,
    storageError,
  } = useSyndicate();

  async function toggle(sector: SectorId, enabled: boolean) {
    try {
      await setSectorEnabled(sector, enabled);
    } catch {
      // The storage failure is shown to the user without changing the assignment.
    }
  }

  return (
    <PageScroll>
      <PageHeader
        title="Sector modules"
        subtitle="Assign the workflows this client needs."
      />
      <StorageNotice message={storageError} />

      <View style={[styles.introPanel, { backgroundColor: colors.hero }]}>
        <View style={styles.introIcon}>
          <Feather name="sliders" size={19} color={colors.heroForeground} />
        </View>
        <Text style={[styles.introTitle, { color: colors.heroForeground }]}>
          One platform. Client-specific workflows.
        </Text>
        <Text style={styles.introBody}>
          Shared governance and project accounts stay consistent while each client gets only the sector tools they use.
        </Text>
        <View style={styles.introFoot}>
          <Feather name="info" size={12} color={colors.heroForeground} />
          <Text style={styles.introFootText}>
            Changes on this screen are saved locally for the demo.
          </Text>
        </View>
      </View>

      <View style={styles.countRow}>
        <Text style={[styles.countTitle, { color: colors.foreground }]}>
          Available packages
        </Text>
        <Text style={[styles.countValue, { color: colors.primary }]}>
          {enabledSectors.length} / {SECTORS.length} assigned
        </Text>
      </View>

      <View style={styles.moduleList}>
        {SECTORS.map((sector) => {
          const active = enabledSectors.includes(sector.id);
          const affectedCount = ventures.filter(
            (venture) => venture.sector === sector.id,
          ).length;
          return (
            <Pressable
              key={sector.id}
              onPress={() => void toggle(sector.id, !active)}
              accessibilityRole="switch"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${sector.name} module`}
              testID={`module-toggle-${sector.id}`}
              style={({ pressed }) => [
                styles.moduleCard,
                {
                  backgroundColor: colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <SectorMark sector={sector.id} size="large" />
              <View style={styles.moduleCopy}>
                <View style={styles.moduleTitleRow}>
                  <Text
                    style={[styles.moduleTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {sector.name}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: active
                          ? colors.successSurface
                          : colors.muted,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDotInner,
                        {
                          backgroundColor: active
                            ? colors.success
                            : colors.mutedForeground,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.moduleDescription, { color: colors.mutedForeground }]}>
                  {sector.description}
                </Text>
                <Text
                  style={[
                    styles.moduleAssigned,
                    { color: active ? colors.success : colors.mutedForeground },
                  ]}
                >
                  {active
                    ? `${affectedCount} sample ${affectedCount === 1 ? 'venture' : 'ventures'}`
                    : 'Not assigned to this client'}
                </Text>
              </View>
              <Feather
                name={active ? 'check-circle' : 'circle'}
                size={20}
                color={active ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.footnote, { borderColor: colors.border }]}>
        <Feather name="lock" size={15} color={colors.mutedForeground} />
        <Text style={[styles.footnoteText, { color: colors.mutedForeground }]}>
          Client assignment, role access, and sector data isolation will be enforced by the production backend.
        </Text>
      </View>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  introPanel: {
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    lineHeight: 23,
  },
  introBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(246,245,236,0.75)',
  },
  introFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 5,
  },
  introFootText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: 'rgba(246,245,236,0.72)',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  countTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  countValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  moduleList: {
    gap: 10,
  },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  moduleCopy: {
    flex: 1,
    gap: 5,
  },
  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  moduleTitle: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  moduleDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    lineHeight: 14,
  },
  moduleAssigned: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotInner: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  footnote: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  footnoteText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 15,
  },
});
