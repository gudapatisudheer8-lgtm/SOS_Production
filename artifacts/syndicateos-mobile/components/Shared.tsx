import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { PropsWithChildren } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SectorId,
  SECTORS,
  Venture,
} from '@/context/SyndicateContext';
import { useColors } from '@/hooks/useColors';

const sectorIcons: Record<SectorId, React.ComponentProps<typeof Feather>['name']> = {
  'real-estate': 'map',
  residential: 'home',
  'liquor-retail': 'shopping-bag',
  infrastructure: 'truck',
};

export function formatCompactINR(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export async function tapHaptic() {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics are an optional enhancement; the interaction still works without them.
  }
}

interface PageScrollProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle>;
}

export function PageScroll({ children, contentStyle }: PageScrollProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.pageContent,
        {
          paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12,
          paddingBottom:
            Platform.OS === 'web' ? 118 : Math.max(insets.bottom, 20) + 102,
        },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: React.ComponentProps<typeof Feather>['name'];
  onAction?: () => void;
}

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
}: PageHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.headerWrap}>
      <View style={styles.brandRow}>
        <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
          <Feather name="layers" size={16} color={colors.primaryForeground} />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={[styles.brandName, { color: colors.foreground }]}>
            SYNDICATEOS
          </Text>
          <Text style={[styles.clientName, { color: colors.mutedForeground }]}>
            SAMPLE CLIENT · HYDERABAD
          </Text>
        </View>
        <View
          style={[
            styles.demoBadge,
            { backgroundColor: colors.warningSurface },
          ]}
        >
          <Text style={[styles.demoText, { color: colors.warning }]}>DEMO</Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        </View>
        {onAction && actionIcon ? (
          <Pressable
            onPress={() => {
              void tapHaptic();
              onAction();
            }}
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? title}
            testID={`header-action-${actionIcon}`}
            style={({ pressed }) => [
              styles.headerAction,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name={actionIcon} size={19} color={colors.primaryForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SectionTitle({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

export function TextAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        void tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      testID={`action-${label.toLowerCase().replaceAll(' ', '-')}`}
      hitSlop={8}
    >
      <Text style={[styles.textAction, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function SectorMark({
  sector,
  size = 'regular',
}: {
  sector: SectorId;
  size?: 'small' | 'regular' | 'large';
}) {
  const colors = useColors();
  const sectorIndex = SECTORS.findIndex((item) => item.id === sector);
  const surface = [
    colors.successSurface,
    colors.warningSurface,
    colors.secondary,
    colors.muted,
  ][Math.max(0, sectorIndex)];
  const foreground = [
    colors.success,
    colors.warning,
    colors.primary,
    colors.mutedForeground,
  ][Math.max(0, sectorIndex)];
  const dimension = size === 'large' ? 48 : size === 'small' ? 34 : 40;
  const iconSize = size === 'large' ? 22 : size === 'small' ? 15 : 18;
  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: size === 'small' ? 11 : 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: surface,
      }}
    >
      <Feather name={sectorIcons[sector]} size={iconSize} color={foreground} />
    </View>
  );
}

export function SectorLabel({ sector }: { sector: SectorId }) {
  const colors = useColors();
  const definition = SECTORS.find((item) => item.id === sector);
  return (
    <View style={[styles.sectorPill, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.sectorPillText, { color: colors.secondaryForeground }]}>
        {definition?.shortName ?? 'Sector'}
      </Text>
    </View>
  );
}

export function VentureCard({
  venture,
  onPress,
}: {
  venture: Venture;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        void tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${venture.name}, ${venture.location}, ${venture.status}`}
      testID={`venture-${venture.id}`}
      style={({ pressed }) => [
        styles.ventureCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={styles.ventureTopRow}>
        <SectorMark sector={venture.sector} size="regular" />
        <View style={styles.ventureNameWrap}>
          <Text style={[styles.ventureName, { color: colors.foreground }]} numberOfLines={1}>
            {venture.name}
          </Text>
          <Text
            style={[styles.ventureLocation, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {venture.location}
          </Text>
        </View>
        <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
      </View>
      <View style={styles.ventureMetaRow}>
        <SectorLabel sector={venture.sector} />
        <Text style={[styles.metricCaption, { color: colors.mutedForeground }]}>
          {venture.operationalMetric}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(0, Math.min(venture.progress, 100))}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
      <View style={styles.ventureBottomRow}>
        <Text style={[styles.moneyText, { color: colors.foreground }]}>
          {formatCompactINR(venture.deployed)}
          <Text style={[styles.moneyMuted, { color: colors.mutedForeground }]}>
            {' '}
            deployed
          </Text>
        </Text>
        <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
          {venture.progress}% · {venture.status}
        </Text>
      </View>
    </Pressable>
  );
}

export function MetricCard({
  label,
  value,
  caption,
  icon,
  style,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.metricCardHead}>
        <Feather name={icon} size={16} color={colors.primary} />
        <Text style={[styles.metricCardLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.metricCardValue, { color: colors.foreground }]}>
        {value}
      </Text>
      {caption ? (
        <Text style={[styles.metricCardCaption, { color: colors.mutedForeground }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function StorageNotice({ message }: { message: string | null }) {
  const colors = useColors();
  if (!message) return null;
  return (
    <View
      style={[
        styles.storageNotice,
        { backgroundColor: colors.warningSurface, borderColor: colors.border },
      ]}
    >
      <Feather name="alert-triangle" size={16} color={colors.warning} />
      <Text style={[styles.storageNoticeText, { color: colors.warning }]}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'layers',
  action,
}: {
  title: string;
  message: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  action?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.emptyState,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function Surface({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  pageContent: {
    paddingHorizontal: 20,
    gap: 22,
  },
  headerWrap: {
    gap: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    fontSize: 11,
    letterSpacing: 1.35,
    fontFamily: 'Inter_700Bold',
  },
  clientName: {
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: 'Inter_500Medium',
  },
  demoBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 30,
  },
  demoText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  titleCopy: {
    flex: 1,
    gap: 5,
  },
  pageTitle: {
    fontSize: 29,
    lineHeight: 34,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  headerAction: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  textAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  sectorPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  sectorPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  ventureCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    gap: 15,
  },
  ventureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  ventureNameWrap: {
    flex: 1,
    gap: 4,
  },
  ventureName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  ventureLocation: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  ventureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricCaption: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
    flexShrink: 1,
  },
  progressTrack: {
    height: 5,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  ventureBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  moneyText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  moneyMuted: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  progressText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    gap: 9,
    minWidth: 132,
  },
  metricCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metricCardLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  metricCardValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  metricCardCaption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  storageNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
  },
  storageNoticeText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 16,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  surface: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
});
