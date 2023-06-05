import { ReactElement, useContext, useMemo } from 'react';
import { useFonts } from '../../shared/lib/useFonts';
import { LoginContext } from '../../shared/LoginContext';
import { useTimedValue } from '../../shared/hooks/useTimedValue';
import { LoginApp } from '../login/LoginApp';
import { SplashScreen } from '../splash/SplashScreen';
import { FavoritesTabbedPane } from './screens/FavoritesTabbedPane';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImageProps, useOsehImageState } from '../../shared/OsehImage';

const requiredFonts = ['400 1em Open Sans', '600 1em Open Sans', '700 1em Open Sans'];

/**
 * Allows the user to see their favorites and history in a tabbed pane.
 * This is the entry point for the page, which primarily handles showing
 * a splash screen until enough is loaded to be useful
 *
 * Should be wrapped in a login and interests provider
 */
export const FavoritesApp = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const fontsLoaded = useFonts(requiredFonts);
  const flashWhiteInsteadOfSplash = useTimedValue<boolean>(true, false, 250);
  const windowSize = useWindowSize();

  const backgroundProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_0ykGW_WatP5-mh-0HRsrNw',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
    }),
    [windowSize]
  );
  const background = useOsehImageState(backgroundProps);

  if (loginContext.state === 'logged-out') {
    return <LoginApp redirectUrl="/favorites" />;
  }

  if (loginContext.state === 'loading' || !fontsLoaded || background.loading) {
    if (flashWhiteInsteadOfSplash) {
      return <></>;
    }
    return <SplashScreen type="wordmark" />;
  }

  return <FavoritesTabbedPane background={background} />;
};
