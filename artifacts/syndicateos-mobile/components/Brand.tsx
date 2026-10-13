import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';
import { useColors } from '@/hooks/useColors';

const horizontal = require('@/assets/brand/logo-horizontal.png');
const stacked = require('@/assets/brand/logo-stacked.png');
const mark = require('@/assets/brand/mark.png');

/** Official orange/black SyndicateOS logo (static PNG rendered from Inter Black, identical on web and native).
 *  Default is the stacked welcome lockup; pass layout="horizontal" for constrained header slots. */
export function BrandLogo({ width = 220, plate = true, layout = 'stacked' }: { width?: number; plate?: boolean; layout?: 'stacked' | 'horizontal' }) {
  const pad = plate ? Math.round(width * 0.06) : 0;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="SyndicateOS"
      style={plate ? { backgroundColor: '#f6f4ec', borderRadius: 14, padding: pad, paddingHorizontal: pad * 1.5, alignSelf: layout === 'stacked' ? 'center' : 'flex-start' } : undefined}
    >
      <Image source={layout === 'stacked' ? stacked : horizontal} contentFit="contain" style={{ width, aspectRatio: layout === 'stacked' ? 1180 / 703 : 1086 / 224 }} accessibilityLabel="SyndicateOS" />
    </View>
  );
}

/** Icon-only orange SOS mark for compact headers. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <Image source={mark} contentFit="contain" style={{ width: size, height: size }} accessibilityLabel="SyndicateOS" />;
}

/** Soft ivory to pale blue backdrop with restrained decoration. */
export function BrandBackdrop({ children }: { children?: React.ReactNode }) {
  const c = useColors();
  const dark = c.background === '#0c1226';
  return (
    <LinearGradient
      colors={dark ? ['#0c1226', '#141c38'] : ['#f6f4ec', '#e4ecf8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: -120, right: -120, width: 320, height: 320, borderRadius: 160, backgroundColor: c.primary, opacity: 0.06 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -140, left: -100, width: 280, height: 280, borderRadius: 140, backgroundColor: c.accent, opacity: 0.12 }} />
      {children}
    </LinearGradient>
  );
}
