import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatCompactINR,
  PageHeader,
  PageScroll,
  SectionTitle,
  StorageNotice,
  Surface,
} from '@/components/Shared';
import {
  SAMPLE_ACCOUNTS,
  SAMPLE_TRANSACTIONS,
  useSyndicate,
} from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

export default function LedgerScreen() {
  const colors = useColors();
  const { storageError } = useSyndicate();
  const accountTotal = SAMPLE_ACCOUNTS.reduce(
    (sum, account) => sum + account.balance,
    0,
  );

  return (
    <PageScroll>
      <PageHeader
        title="Project accounts"
        subtitle="Separate balances, transparent movement."
      />
      <StorageNotice message={storageError} />

      <View style={[styles.totalPanel, { backgroundColor: colors.hero }]}>
        <View style={styles.totalHead}>
          <View>
            <Text style={styles.totalLabel}>SAMPLE BALANCES</Text>
            <Text style={[styles.totalAmount, { color: colors.heroForeground }]}>
              {formatCompactINR(accountTotal)}
            </Text>
          </View>
          <View style={styles.protectedMark}>
            <Feather name="shield" size={17} color={colors.heroForeground} />
          </View>
        </View>
        <Text style={styles.totalNote}>
          Demo account figures · not live bank balances
        </Text>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Mapped accounts" />
        <View style={styles.accountList}>
          {SAMPLE_ACCOUNTS.map((account, index) => (
            <Surface key={account.id} style={styles.accountCard}>
              <View
                style={[
                  styles.accountIcon,
                  {
                    backgroundColor:
                      index === 0 ? colors.successSurface : colors.secondary,
                  },
                ]}
              >
                <Feather
                  name={account.protected ? 'shield' : 'briefcase'}
                  size={17}
                  color={account.protected ? colors.success : colors.primary}
                />
              </View>
              <View style={styles.accountCopy}>
                <View style={styles.accountTitleRow}>
                  <Text
                    style={[styles.accountName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {account.name}
                  </Text>
                  {account.protected ? (
                    <View
                      style={[
                        styles.protectedBadge,
                        { backgroundColor: colors.successSurface },
                      ]}
                    >
                      <Text style={[styles.protectedText, { color: colors.success }]}>
                        70% ESCROW
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.accountMeta, { color: colors.mutedForeground }]}>
                  {account.type} · {account.note}
                </Text>
              </View>
              <Text style={[styles.accountBalance, { color: colors.foreground }]}>
                {formatCompactINR(account.balance)}
              </Text>
            </Surface>
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle title="Recent activity" />
        <Surface style={styles.activityCard}>
          {SAMPLE_TRANSACTIONS.map((transaction, index) => {
            const isIncoming = transaction.direction === 'in';
            return (
              <View key={transaction.id} style={styles.transactionRow}>
                <View
                  style={[
                    styles.transactionIcon,
                    {
                      backgroundColor: isIncoming
                        ? colors.successSurface
                        : colors.warningSurface,
                    },
                  ]}
                >
                  <Feather
                    name={isIncoming ? 'arrow-down-left' : 'arrow-up-right'}
                    size={16}
                    color={isIncoming ? colors.success : colors.warning}
                  />
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={[styles.transactionTitle, { color: colors.foreground }]}>
                    {transaction.title}
                  </Text>
                  <Text
                    style={[
                      styles.transactionMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {transaction.detail}
                  </Text>
                  <Text
                    style={[
                      styles.transactionDate,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {transaction.date}
                  </Text>
                </View>
                <View style={styles.transactionAmountWrap}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: isIncoming ? colors.success : colors.foreground },
                    ]}
                  >
                    {isIncoming ? '+' : '−'}
                    {formatCompactINR(transaction.amount)}
                  </Text>
                  <Text
                    style={[
                      styles.transactionStatus,
                      {
                        color:
                          transaction.status === 'Verified'
                            ? colors.success
                            : colors.warning,
                      },
                    ]}
                  >
                    {transaction.status}
                  </Text>
                </View>
                {index < SAMPLE_TRANSACTIONS.length - 1 ? (
                  <View
                    style={[
                      styles.transactionDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </Surface>
      </View>

      <View style={[styles.auditNote, { backgroundColor: colors.secondary }]}>
        <Feather name="check-circle" size={16} color={colors.primary} />
        <Text style={[styles.auditText, { color: colors.secondaryForeground }]}>
          Sample receipt and payout activity only. Double-entry posting, verified vouchers, and a full audit trail need the live backend connection.
        </Text>
      </View>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  totalPanel: {
    borderRadius: 23,
    padding: 19,
    gap: 12,
  },
  totalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(246,245,236,0.7)',
    fontSize: 10,
    letterSpacing: 1,
  },
  totalAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    marginTop: 5,
    letterSpacing: -0.8,
  },
  protectedMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalNote: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(246,245,236,0.65)',
    fontSize: 10,
  },
  sectionBlock: {
    gap: 12,
  },
  accountList: {
    gap: 9,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 17,
  },
  accountIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  accountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    flexShrink: 1,
  },
  accountMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    lineHeight: 13,
  },
  accountBalance: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  protectedBadge: {
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  protectedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 7,
    letterSpacing: 0.25,
  },
  activityCard: {
    paddingHorizontal: 13,
    paddingVertical: 0,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 14,
    position: 'relative',
  },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  transactionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  transactionMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
  },
  transactionDate: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    marginTop: 2,
  },
  transactionAmountWrap: {
    alignItems: 'flex-end',
    gap: 5,
  },
  transactionAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  transactionStatus: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
  },
  transactionDivider: {
    position: 'absolute',
    bottom: 0,
    left: 44,
    right: 0,
    height: 1,
  },
  auditNote: {
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  auditText: {
    fontFamily: 'Inter_400Regular',
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
  },
});
