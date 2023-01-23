import { useEffect, useState } from 'react';

/**
 * Loads the given fonts in the background, returning true when they are loaded
 * and false otherwise. If the fonts cannot be loaded in the background, returns
 * true.
 *
 * @param fonts The fonts to load.
 * @returns True if the fonts are loaded, false otherwise.
 */
export const useFonts = (fonts: string[]): boolean => {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (!document.fonts || !document.fonts.load) {
      setFontsLoaded(true);
      return;
    }

    let active = true;
    loadRequiredFonts();
    return () => {
      active = false;
    };

    async function loadRequiredFonts() {
      try {
        await Promise.all(fonts.map((font) => document.fonts.load(font)));
      } catch (e) {
        console.error('error while loading required fonts', e);
      } finally {
        if (active) {
          setFontsLoaded(true);
        }
      }
    }
  }, [fonts]);

  return fontsLoaded;
};
