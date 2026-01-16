import { useState, useEffect } from 'react';
import { MantineProvider, createTheme, Loader, Center, Text, Stack } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';
import ColorThief from 'colorthief';

const DEFAULT_COLOR = '#008080'; // Teal fallback

export function BrandThemeProvider({ children }) {
  const [primaryColor, setPrimaryColor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, success, fallback

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Critical for pixel access
    img.src = '/logo.png';

    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const [r, g, b] = colorThief.getColor(img);

        // Convert RGB to Hex
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

        console.log(`🎨 Logo Color Found: ${hex} (R:${r} G:${g} B:${b})`);

        // SAFETY CHECK: If color is too dark (Black) or too light (White), use fallback
        // Simple brightness formula
        const brightness = Math.round(((parseInt(r) * 299) + (parseInt(g) * 587) + (parseInt(b) * 114)) / 1000);

        if (brightness < 20 || brightness > 240) {
          console.warn("⚠️ Color is too black/white for a UI theme. Using fallback.");
          setPrimaryColor(DEFAULT_COLOR);
          setStatus('fallback');
        } else {
          setPrimaryColor(hex);
          setStatus('success');
        }

      } catch (e) {
        console.error("❌ Color extraction failed:", e);
        setPrimaryColor(DEFAULT_COLOR);
        setStatus('fallback');
      }
    };

    img.onerror = () => {
      console.error("❌ Could not load /logo.png");
      setPrimaryColor(DEFAULT_COLOR);
      setStatus('fallback');
    };

  }, []);

  // 1. LOADING SCREEN
  if (!primaryColor) {
    return (
      <MantineProvider>
        <Center h="100vh">
          <Stack align="center">
            <Loader size="xl" type="bars" />
            <Text c="dimmed" size="sm">Analyzing Brand Identity...</Text>
          </Stack>
        </Center>
      </MantineProvider>
    );
  }

  // 2. GENERATE THEME
  const brandPalette = generateColors(primaryColor);

  const theme = createTheme({
    primaryColor: 'brand',
    colors: {
      brand: brandPalette,
    },
    defaultRadius: 'md',
    fontFamily: 'Inter, system-ui, sans-serif',
  });

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {children}
    </MantineProvider>
  );
}
