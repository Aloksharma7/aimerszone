/**
 * NativeWind (className, matching tailwind.config.js) is the styling
 * approach for components — use this file only where a component needs a
 * raw color value instead of a className: StatusBar bar style, native chart
 * libraries, SafeAreaView backgrounds set via style props, etc.
 *
 * Values are copied 1:1 from tailwind.config.js / the web app's brand
 * palette — keep both in sync if either changes.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0f172a',
    background: '#ffffff',
    backgroundElement: '#f8fafc',
    backgroundSelected: '#eff6ff',
    textSecondary: '#64748b',
    brand: '#1d4ed8',
    brandDark: '#172554',
  },
  dark: {
    text: '#f8fafc',
    background: '#0b1739',
    backgroundElement: '#172554',
    backgroundSelected: '#1e3a8a',
    textSecondary: '#94a3b8',
    brand: '#3b82f6',
    brandDark: '#0b1739',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
