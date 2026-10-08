/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#18251f',
    tint: '#1b6b51',
    background: '#f3f5f1',
    foreground: '#18251f',
    card: '#ffffff',
    cardForeground: '#18251f',
    primary: '#1b6b51',
    primaryForeground: '#ffffff',
    secondary: '#e8eee8',
    secondaryForeground: '#274337',
    muted: '#edf1ec',
    mutedForeground: '#718078',
    accent: '#d59a52',
    accentForeground: '#332311',
    destructive: '#b94c3b',
    destructiveForeground: '#ffffff',
    border: '#dfe6df',
    input: '#dfe6df',
    success: '#28785b',
    successSurface: '#e8f3ec',
    warning: '#a86c20',
    warningSurface: '#fbf0df',
    hero: '#173c31',
    heroForeground: '#f6f5ec',
  },
  dark: {
    text: '#edf3ee',
    tint: '#7cc2a0',
    background: '#101a16',
    foreground: '#edf3ee',
    card: '#19251f',
    cardForeground: '#edf3ee',
    primary: '#7cc2a0',
    primaryForeground: '#10251b',
    secondary: '#24332b',
    secondaryForeground: '#d6e5da',
    muted: '#202d26',
    mutedForeground: '#a2b2a7',
    accent: '#e0ad68',
    accentForeground: '#302313',
    destructive: '#df7564',
    destructiveForeground: '#ffffff',
    border: '#2c3b33',
    input: '#34463b',
    success: '#83c59d',
    successSurface: '#1d3829',
    warning: '#e6b468',
    warningSurface: '#3a2f1e',
    hero: '#142e25',
    heroForeground: '#f6f5ec',
  },
  radius: 18,
};

export default colors;
