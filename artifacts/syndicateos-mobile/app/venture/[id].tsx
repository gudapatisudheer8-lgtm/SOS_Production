import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  formatCompactINR,
  PageHeader,
  PageScroll,
  SectorLabel,
  StorageNotice,
} from '@/components/Shared';
import { SECTORS, useSyndicate } from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

export default function VentureDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ventures, storageError } = useSyndicate();
  const venture = ventures.find((item) => item.id === id);

  if (!venture) {
    return (
      <PageScroll>
        <PageHeader
          title="Venture not found"
          subtitle="This sample venture may have been removed."
          actionLabel="Go back"
          actionIcon="arrow-left"
          onAction={() => router.back()}
        />
        <EmptyState
          title="No matching venture"
          message="Go back to the client portfolio and choose one of its ventures."
          icon="search"
        />
      </PageScroll>
    );
  }

  const sector = SECTORS.find((item) => item.id === venture.sector);
  const remaining = Math.max(venture.committed - venture.deployed, 0);

  return (
    <PageScroll>
      <PageHeader
        title={venture.name}
        subtitle={venture.location}
        actionLabel="Back to ventures"
        actionIcon="arrow-left"
        onAction={() => router.back()}
      />
      <StorageNotice message={storageError} />

      <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.identityTop}>
          <View style={[styles.sectorIcon, { backgroundColor: colors.successSurface }]}>
            <Feather name="layers" size={21} color={colors.primary} />
          </View>
          <View style={styles.identityCopy}>
            <SectorLabel sector={venture.sector} />
            <Text style={[styles.identityStatus, { color: colors.mutedForeground }]}>
              {venture.status} · {sector?.name}
            </Text>
          </View>
          <View style={[styles.demoBadge, { backgroundColor: colors.warningSurface }]}>
            <Text style={[styles.demoBadgeText, { color: colors.warning }]}>DEMO</Text>
          </View>
        </View>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            Operational progress
          </Text>
          <Text style={[styles.progressValue, { color: colors.primary }]}>
            {venture.progress}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${venture.progress}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        <Text style={[styles.stageText, { color: colors.foreground }]}>
          Current stage · {venture.stage}
        </Text>
      </View>

      <View style={styles.moneyRow}>
        <View style={[styles.moneyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>
            CAPITAL COMMITTED
          </Text>
          <Text style={[styles.moneyValue, { color: colors.foreground }]}>
            {formatCompactINR(venture.committed)}
          </Text>
        </View>
        <View style={[styles.moneyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>
            DEPLOYED
          </Text>
          <Text style={[styles.moneyValue, { color: colors.foreground }]}>
            {formatCompactINR(venture.deployed)}
          </Text>
        </View>
      </View>

      <View style={[styles.operationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.operationHead}>
          <Text style={[styles.operationTitle, { color: colors.foreground }]}>
            Sector operations
          </Text>
          <Feather name="arrow-up-right" size={17} color={colors.primary} />
        </View>
        <Text style={[styles.operationMetric, { color: colors.foreground }]}>
          {venture.operationalMetric}
        </Text>
        <Text style={[styles.operationCaption, { color: colors.mutedForeground }]}>
          Workflow · {sector?.shortName}
        </Text>
      </View>

      <View style={[styles.accountCard, { backgroundColor: colors.successSurface }]}>
        <View style={styles.accountIcon}>
          <Feather name="shield" size={17} color={colors.primary} />
        </View>
        <View style={styles.accountCopy}>
          <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>
            PROJECT ACCOUNT
          </Text>
          <Text style={[styles.accountName, { color: colors.foreground }]}>
            {venture.accountName}
          </Text>
          {venture.accountName === 'Not linked yet' ? (
            <Text style={[styles.accountPending, { color: colors.warning }]}>
              Account mapping is not available in the local demo.
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.partnerCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.partnerIcon}>
          <Feather name="users" size={17} color={colors.primary} />
        </View>
        <View style={styles.partnerCopy}>
          <Text style={[styles.partnerCount, { color: colors.foreground }]}>
            {venture.partnerCount} partners
          </Text>
          <Text style={[styles.partnerCaption, { color: colors.mutedForeground }]}>
            {formatCompactINR(remaining)} un-deployed from committed capital
          </Text>
        </View>
      </View>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 16,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  sectorIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    gap: 7,
  },
  identityStatus: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  demoBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  demoBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 0.7,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  progressValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  progressTrack: {
    height: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  stageText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  moneyCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 9,
  },
  moneyLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  moneyValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
  },
  operationCard: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 15,
    gap: 8,
  },
  operationHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  operationTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  operationMetric: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    marginTop: 3,
  },
  operationCaption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  accountCard: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
    gap: 4,
  },
  accountLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    letterSpacing: 0.7,
  },
  accountName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  accountPending: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
  },
  partnerCard: {
    borderRadius: 17,
    padding: 13,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  partnerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerCopy: {
    flex: 1,
    gap: 4,
  },
  partnerCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  partnerCaption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
  },
});
