import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  PageHeader,
  PageScroll,
  SectorLabel,
  StorageNotice,
  VentureCard,
} from '@/components/Shared';
import {
  SectorId,
  SECTORS,
  useSyndicate,
} from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

export default function VenturesScreen() {
  const colors = useColors();
  const { ventures, enabledSectors, storageError } = useSyndicate();
  const [filter, setFilter] = useState<SectorId | 'all'>('all');
  const filters = useMemo(
    () => [
      { id: 'all' as const, label: 'All' },
      ...SECTORS.filter((sector) => enabledSectors.includes(sector.id)).map(
        (sector) => ({ id: sector.id, label: sector.shortName }),
      ),
    ],
    [enabledSectors],
  );
  const visible = ventures.filter(
    (venture) =>
      enabledSectors.includes(venture.sector) &&
      (filter === 'all' || venture.sector === filter),
  );

  return (
    <PageScroll>
      <PageHeader
        title="Ventures"
        subtitle="Projects attached to this client workspace."
        actionLabel="Create venture"
        actionIcon="plus"
        onAction={() => router.push('/venture/new')}
      />
      <StorageNotice message={storageError} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filters.map((item) => {
          const selected = item.id === filter;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`venture-filter-${item.id}`}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.summaryRow}>
        <View>
          <Text style={[styles.summaryCount, { color: colors.foreground }]}>
            {visible.length} {visible.length === 1 ? 'venture' : 'ventures'}
          </Text>
          <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
            {enabledSectors.length} sector packages assigned
          </Text>
        </View>
        <View style={[styles.demoTag, { backgroundColor: colors.warningSurface }]}>
          <Feather name="info" size={12} color={colors.warning} />
          <Text style={[styles.demoTagText, { color: colors.warning }]}>
            Sample records
          </Text>
        </View>
      </View>

      {visible.length ? (
        <View style={styles.ventureList}>
          {visible.map((venture) => (
            <VentureCard
              key={venture.id}
              venture={venture}
              onPress={() =>
                router.push({
                  pathname: '/venture/[id]',
                  params: { id: venture.id },
                })
              }
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No ventures for this filter"
          message={
            enabledSectors.length
              ? 'Try another sector or create a venture in this workflow.'
              : 'Assign at least one sector package to this client before creating a venture.'
          }
          icon="briefcase"
          action={
            <Pressable
              onPress={() =>
                router.push(
                  enabledSectors.length ? '/venture/new' : '/(tabs)/modules',
                )
              }
              accessibilityRole="button"
              testID="venture-empty-action"
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>
                {enabledSectors.length ? 'Create venture' : 'Assign sectors'}
              </Text>
            </Pressable>
          }
        />
      )}

      <View style={[styles.note, { backgroundColor: colors.secondary }]}>
        <Feather name="layers" size={16} color={colors.primary} />
        <View style={styles.noteCopy}>
          <Text style={[styles.noteTitle, { color: colors.foreground }]}>
            Shared core, sector-specific operations
          </Text>
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Each venture uses its assigned workflow and keeps its project accounts separate.
          </Text>
        </View>
      </View>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    gap: 8,
    paddingRight: 20,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  summaryCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  summaryNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 3,
  },
  demoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  demoTagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
  },
  ventureList: {
    gap: 11,
  },
  emptyAction: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderRadius: 18,
  },
  noteCopy: {
    flex: 1,
    gap: 4,
  },
  noteTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  noteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 15,
  },
});
