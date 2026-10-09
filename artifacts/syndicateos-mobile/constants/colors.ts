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
    text: '#101b3a',
    tint: '#14224a',
    background: '#f6f4ec',
    foreground: '#101b3a',
    card: '#ffffff',
    cardForeground: '#101b3a',
    primary: '#14224a',
    primaryForeground: '#ffffff',
    secondary: '#e4eaf5',
    secondaryForeground: '#14224a',
    muted: '#edf0f7',
    mutedForeground: '#5d6785',
    accent: '#8fb0e0',
    accentForeground: '#101b3a',
    destructive: '#b94c3b',
    destructiveForeground: '#ffffff',
    border: '#d9dfec',
    input: '#d9dfec',
    success: '#28785b',
    successSurface: '#e8f3ec',
    warning: '#a86c20',
    warningSurface: '#fbf0df',
    hero: '#14224a',
    heroForeground: '#f6f4ec',
  },
  dark: {
    text: '#eef1fa',
    tint: '#9db8ee',
    background: '#0c1226',
    foreground: '#eef1fa',
    card: '#141c38',
    cardForeground: '#eef1fa',
    primary: '#9db8ee',
    primaryForeground: '#0c1226',
    secondary: '#1f2a4d',
    secondaryForeground: '#dbe4fa',
    muted: '#1a2342',
    mutedForeground: '#9ea9c8',
    accent: '#9db8ee',
    accentForeground: '#0c1226',
    destructive: '#df7564',
    destructiveForeground: '#ffffff',
    border: '#273259',
    input: '#324070',
    success: '#83c59d',
    successSurface: '#1d3829',
    warning: '#e6b468',
    warningSurface: '#3a2f1e',
    hero: '#101a3a',
    heroForeground: '#f6f4ec',
  },
  radius: 18,
};

export default colors;
