import React from 'react';
import { Stack } from 'expo-router';
import { Text, TextInput, StyleSheet, Platform } from 'react-native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

// ─── Icon font guard ──────────────────────────────────────────────────────────
const ICON_FONT_FAMILIES = [
  'MaterialIcons', 'MaterialCommunityIcons', 'Ionicons',
  'FontAwesome', 'FontAwesome5', 'FontAwesome5_Brands',
  'FontAwesome5_Regular', 'FontAwesome5_Solid',
  'AntDesign', 'Entypo', 'EvilIcons', 'Feather',
  'Foundation', 'Octicons', 'SimpleLineIcons', 'Zocial',
  'glyphicons', 'icomoon',
];

const isIconFont = (fontFamily: string): boolean => {
  if (!fontFamily) return false;
  return ICON_FONT_FAMILIES.some((icon) =>
    fontFamily.toLowerCase().includes(icon.toLowerCase())
  );
};

const getPoppinsFontFamily = (fontWeight?: string | number): string => {
  const fw = String(fontWeight ?? '400');
  if (fw === 'bold' || fw === '700') return 'Poppins_700Bold';
  if (fw === '800' || fw === '900') return 'Poppins_800ExtraBold';
  if (fw === '600') return 'Poppins_600SemiBold';
  if (fw === '500') return 'Poppins_500Medium';
  return 'Poppins_400Regular';
};

// ─── Web CSS injection (browser only) ────────────────────────────────────────
if (Platform.OS === 'web') {
  try {
    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.appendChild(
      document.createTextNode(`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        body, p, span, h1, h2, h3, h4, h5, h6,
        label, button, input, textarea, select,
        div[class*="css-"] {
          font-family: 'Poppins', sans-serif;
        }
      `)
    );
    document.head.appendChild(styleEl);
    console.log('✅ Web: Poppins applied via CSS');
  } catch (err) {
    console.error('Failed to inject Web font CSS:', err);
  }
}

// ─── Mobile font injection via defaultProps ───────────────────────────────────
//
// WHY NOT Text.render patching?
// Expo Go's Fast Refresh re-initialises React Native internals on every reload,
// silently breaking the render patch. The result: Poppins never applies after
// the first hot reload, and there is no error shown.
//
// WHY defaultProps?
// defaultProps are merged into every instance at render time, AFTER Fast
// Refresh re-mounts components. They survive reloads reliably.
//
// HOW it works:
// React Native's Text/TextInput merge `defaultProps.style` with the instance
// style. We set a base style with fontFamily. If the component later sets its
// own fontFamily (e.g. an icon library), that overrides defaultProps — so
// icon fonts are naturally preserved without any extra guard needed.

if (Platform.OS !== 'web') {
  // ── Text ──────────────────────────────────────────────────────────────────
  const OriginalTextRender = (Text as any).render;

  // Fallback: use defaultProps if render patching isn't available
  const applyMobileFont = () => {
    try {
      // Try render patch first (works on fresh launch)
      const TargetText = Text as any;
      if (TargetText?.render) {
        const originalRender = TargetText.render;
        TargetText.render = function (...args: any[]) {
          const origin = originalRender.apply(this, args);
          if (!origin?.props) return origin;

          const flatStyle = StyleSheet.flatten(origin.props.style) || {};
          const existingFamily: string = flatStyle.fontFamily ?? '';

          if (existingFamily && isIconFont(existingFamily)) return origin;
          if (existingFamily && existingFamily.startsWith('Poppins_')) return origin;

          const fontFamily = getPoppinsFontFamily(flatStyle.fontWeight);
          return React.cloneElement(origin, {
            style: [origin.props.style, { fontFamily }],
          });
        };
      }
    } catch (err) {
      console.warn('Text render patch failed, falling back to defaultProps', err);
    }

    // defaultProps approach — survives Fast Refresh reloads in Expo Go
    try {
      (Text as any).defaultProps = (Text as any).defaultProps || {};
      (Text as any).defaultProps.style = { fontFamily: 'Poppins_400Regular' };

      (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
      (TextInput as any).defaultProps.style = { fontFamily: 'Poppins_400Regular' };

      console.log('✅ Mobile: Poppins set via defaultProps (Fast Refresh safe)');
    } catch (err) {
      console.error('Failed to set defaultProps font:', err);
    }
  };

  applyMobileFont();
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  if (loaded) {
    console.log('🎉 Poppins fonts loaded successfully!');
  }

  // Wait for fonts before rendering — prevents a flash of system font
  if (!loaded && !error) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/welcome" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/otp" />
      <Stack.Screen name="auth/forgot-password" />
      <Stack.Screen name="auth/biometric-auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="announcements/index" />
      <Stack.Screen name="notifications/index" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="profile/personal" />
      <Stack.Screen name="profile/contact" />
      <Stack.Screen name="employees/index" />
      <Stack.Screen name="projects/index" />
      <Stack.Screen name="expenses/index" />
      <Stack.Screen name="payroll/index" />
      <Stack.Screen name="leaves/apply" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="leads/index" />
      <Stack.Screen name="leads/add" />
    </Stack>
  );
}