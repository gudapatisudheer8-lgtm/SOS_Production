import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  formatCompactINR,
  MetricCard,
  PageHeader,
  PageScroll,
  SectionTitle,
  StorageNotice,
  TextAction,
  VentureCard,
} from '@/components/Shared';
import { SECTORS, useSyndicate } from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

export default function DashboardScreen() {
  const colors = useColors();
  const { ventures, enabledSectors, storageError, isReady } = useSyndicate();
  const visibleVentures = ventures.filter((item) =>
    enabledSectors.includes(item.sector),
  );
  const committed = visibleVentures.reduce((sum, item) => sum + item.committed, 0);
  const deployed = visibleVentures.reduce((sum, item) => sum + item.deployed, 0);
  const partners = visibleVentures.reduce((sum, item) => sum + item.partnerCount, 0);
  const recentVentures = visibleVentures.slice(0, 2);

  return (
    <PageScroll>
      <PageHeader
        title="Overview"
        subtitle="A clear view of your ventures and capital."
        actionLabel="Create venture"
        actionIcon="plus"
        onAction={() => router.push('/venture/new')}
      />
      <StorageNotice message={storageError} />

      <View style={[styles.hero, { backgroundColor: colors.hero }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.heroLabel, { color: colors.heroForeground }]}>
              COMMITTED CAPITAL
            </Text>
            <Text style={[styles.heroValue, { color: colors.heroForeground }]}>
              {formatCompactINR(committed)}
            </Text>
          </View>
          <View style={[styles.heroIcon, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Feather name="trending-up" size={19} color={colors.heroForeground} />
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroBottom}>
          <View>
            <Text style={styles.heroStatLabel}>Deployed</Text>
            <Text style={[styles.heroStatValue, { color: colors.heroForeground }]}>
              {formatCompactINR(deployed)}
            </Text>
          </View>
          <View style={styles.heroVerticalRule} />
          <View>
            <Text style={styles.heroStatLabel}>Partner network</Text>
            <Text style={[styles.heroStatValue, { color: colors.heroForeground }]}>
              {partners} partners
            </Text>
          </View>
        </View>
        <View style={styles.demoDisclaimer}>
          <Feather name="info" size={12} color={colors.heroForeground} />
          <Text style={[styles.demoDisclaimerText, { color: colors.heroForeground }]}>
            Sample figures · not connected to a live ledger
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <MetricCard
          label="ACTIVE VENTURES"
          value={String(visibleVentures.length).padStart(2, '0')}
          caption={`${enabledSectors.length} sector workflows`}
          icon="briefcase"
        />
        <MetricCard
          label="IN REVIEW"
          value={String(visibleVentures.filter((item) => item.status === 'Review').length).padStart(2, '0')}
          caption="Needs attention"
          icon="clipboard"
        />
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle
          title="Assigned sectors"
          trailing={
            <TextAction
              label="Manage"
              onPress={() => router.push('/(tabs)/modules')}
            />
          }
        />
        {enabledSectors.length === 0 ? (
          <EmptyState
            title="No sectors assigned"
            message="Enable the workflow packages this client needs."
            icon="grid"
            action={
              <TextAction
                label="Open modules"
                onPress={() => router.push('/(tabs)/modules')}
              />
            }
          />
        ) : (
          <View style={styles.sectorList}>
            {SECTORS.filter((sector) => enabledSectors.includes(sector.id)).map(
              (sector) => {
                const count = ventures.filter(
                  (venture) => venture.sector === sector.id,
                ).length;
                return (
                  <View
                    key={sector.id}
                    style={[
                      styles.sectorRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.sectorDot,
                        { backgroundColor: colors.successSurface },
                      ]}
                    >
                      <Feather name="layers" size={15} color={colors.primary} />
                    </View>
                    <View style={styles.sectorCopy}>
                      <Text style={[styles.sectorName, { color: colors.foreground }]}>
                        {sector.shortName}
                      </Text>
                      <Text
                        style={[
                          styles.sectorSubline,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {sector.description}
                      </Text>
                    </View>
                    <Text style={[styles.sectorCount, { color: colors.primary }]}>
                      {count}
                    </Text>
                  </View>
                );
              },
            )}
          </View>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle
          title="Recent ventures"
          trailing={
            <TextAction
              label="View all"
              onPress={() => router.push('/(tabs)/ventures')}
            />
          }
        />
        {!isReady ? (
          <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading saved demo changes…
            </Text>
          </View>
        ) : recentVentures.length === 0 ? (
          <EmptyState
            title="No ventures in this workspace"
            message="Add a venture under one of the client’s enabled sector workflows."
            icon="briefcase"
            action={
              <TextAction
                label="Create venture"
                onPress={() => router.push('/venture/new')}
              />
            }
          />
        ) : (
          <View style={styles.ventureList}>
            {recentVentures.map((venture) => (
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
        )}
      </View>

      <Pressable
        onPress={() => router.push('/(tabs)/ledger')}
        accessibilityRole="button"
        testID="dashboard-ledger-link"
        style={({ pressed }) => [
          styles.ledgerBanner,
          {
            backgroundColor: colors.successSurface,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.ledgerIcon, { backgroundColor: colors.card }]}>
          <Feather name="shield" size={17} color={colors.primary} />
        </View>
        <View style={styles.ledgerCopy}>
          <Text style={[styles.ledgerTitle, { color: colors.foreground }]}>
            Project accounts stay separate
          </Text>
          <Text style={[styles.ledgerSubline, { color: colors.mutedForeground }]}>
            Review the sample account balances and activity
          </Text>
        </View>
        <Feather name="arrow-up-right" size={17} color={colors.primary} />
      </Pressable>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 19,
    borderRadius: 23,
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 10,
    letterSpacing: 1,
    opacity: 0.75,
    fontFamily: 'Inter_600SemiBold',
  },
  heroValue: {
    fontSize: 32,
    lineHeight: 41,
    letterSpacing: -1.1,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  heroIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroStatLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(246,245,236,0.7)',
  },
  heroStatValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginTop: 4,
  },
  heroVerticalRule: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  demoDisclaimer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    opacity: 0.8,
  },
  demoDisclaimerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 11,
  },
  sectionBlock: {
    gap: 12,
  },
  sectorList: {
    gap: 9,
  },
  sectorRow: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectorDot: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorCopy: {
    flex: 1,
    gap: 3,
  },
  sectorName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  sectorSubline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  sectorCount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  ventureList: {
    gap: 11,
  },
  loadingCard: {
    padding: 20,
    borderRadius: 16,
  },
  loadingText: {
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    fontSize: 12,
  },
  ledgerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 18,
  },
  ledgerIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerCopy: {
    flex: 1,
    gap: 3,
  },
  ledgerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  ledgerSubline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
});
