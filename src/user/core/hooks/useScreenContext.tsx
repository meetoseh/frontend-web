import { useContext, useEffect, useMemo } from 'react';
import {
  InterestsContext,
  InterestsContextProvidedValue,
} from '../../../shared/contexts/InterestsContext';
import { LoginContext, LoginContextValue } from '../../../shared/contexts/LoginContext';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { Resources } from '../models/Resources';
import { setVWC } from '../../../shared/lib/setVWC';
import { useDelayedValueWithCallbacks } from '../../../shared/hooks/useDelayedValueWithCallbacks';
import { useContentWidthValueWithCallbacks } from '../../../shared/lib/useContentWidthValueWithCallbacks';
import { createImagePrivatePlaylistRequestHandler } from '../../../shared/images/createImagePrivatePlaylistRequestHandler';
import { createImagePublicPlaylistRequestHandler } from '../../../shared/images/createImagePublicPlaylistRequestHandler';
import { createImageDataRequestHandler } from '../../../shared/images/createImageDataRequestHandler';
import { createImageCropRequestHandler } from '../../../shared/images/createImageCropRequestHandler';

type WindowSize = {
  width: number;
  height: number;
};

/**
 * Shared state between all screens.
 */
export type ScreenContext = {
  /**
   * User login state, i.e., whether the user is logged in or not and basic information
   * about them. Can also be used for authenticating requests via `apiFetch`.
   */
  login: LoginContextValue;

  /**
   * Contains RequestHandler-like objects which allow for requesting resources
   * in such a way that they can be shared between multiple screens.
   */
  resources: Resources;

  /**
   * The size of the window, as if by `useWindowSize`. This will be updated
   * without delay, so caution needs to be taken to account for potentially
   * rapid (every frame) changes in window size if the user is dragging.
   *
   * Often it makes sense to use `windowSizeImmediate` for the HTML size
   * to render images and `windowSizeDebounced` for downloading images.
   */
  windowSizeImmediate: ValueWithCallbacks<WindowSize>;

  /**
   * A debounced version of `windowSizeImmediate`, as if via
   * `useDelayedValueWithCallbacks(windowSizeImmediate)` with an
   * arbitrary but small delay (to avoid inconsistency on the debounce
   * timeout).
   */
  windowSizeDebounced: ValueWithCallbacks<WindowSize>;

  /**
   * The suggested width of the content area for app-like screens. This will
   * allow for the appropriate horizontal padding when centered within the
   * viewport. Updates immediately when the window size changes.
   */
  contentWidth: ValueWithCallbacks<number>;

  /**
   * The visitor and how they signed up with oseh (i.e, their interests)
   */
  interests: InterestsContextProvidedValue;

  /** True to use webp images, false never to use webp images */
  usesWebp: boolean;

  /** True to use svg vector images, false never to use svg vector images */
  usesSvg: boolean;
};

const areWindowSizesEqual = (a: WindowSize, b: WindowSize): boolean =>
  a.width === b.width && a.height === b.height;

/**
 * Initializes a new screen context that can be used by screens managed by
 * `useScreenQueue`
 */
export const useScreenContext = (usesWebp: boolean, usesSvg: boolean): ScreenContext => {
  const windowSizeImmediate = useWritableValueWithCallbacks<{ width: number; height: number }>(
    () => {
      return { width: window.innerWidth, height: window.innerHeight };
    }
  );

  useEffect(() => {
    let active = true;
    window.addEventListener('resize', update);
    update();
    return () => {
      active = false;
      window.removeEventListener('resize', update);
    };

    function update() {
      if (!active) {
        return;
      }

      setVWC(
        windowSizeImmediate,
        {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        areWindowSizesEqual
      );
    }
  }, [windowSizeImmediate]);

  const windowSizeDebounced = useDelayedValueWithCallbacks(windowSizeImmediate, 100);
  const logging = 'none';
  const cacheSize = 100;
  const privatePlaylistHandler = useWritableValueWithCallbacks(() =>
    createImagePrivatePlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const publicPlaylistHandler = useWritableValueWithCallbacks(() =>
    createImagePublicPlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const imageDataHandler = useWritableValueWithCallbacks(() =>
    createImageDataRequestHandler({ logging, maxStale: cacheSize })
  );
  const imageCropHandler = useWritableValueWithCallbacks(() =>
    createImageCropRequestHandler({ logging, maxStale: cacheSize })
  );

  const resources = useMemo(
    (): Resources => ({
      privatePlaylistHandler: privatePlaylistHandler.get(),
      publicPlaylistHandler: publicPlaylistHandler.get(),
      imageDataHandler: imageDataHandler.get(),
      imageCropHandler: imageCropHandler.get(),
    }),
    [privatePlaylistHandler, publicPlaylistHandler, imageDataHandler, imageCropHandler]
  );

  const loginContext = useContext(LoginContext);
  const interestsContext = useContext(InterestsContext);
  const contentWidth = useContentWidthValueWithCallbacks(windowSizeImmediate);

  return useMemo(
    () => ({
      login: loginContext,
      resources,
      windowSizeImmediate,
      windowSizeDebounced,
      contentWidth,
      interests: interestsContext,
      usesWebp,
      usesSvg,
    }),
    [
      loginContext,
      resources,
      interestsContext,
      windowSizeImmediate,
      windowSizeDebounced,
      contentWidth,
      usesWebp,
      usesSvg,
    ]
  );
};
