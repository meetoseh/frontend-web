import { useContext, useEffect, useMemo } from 'react';
import {
  InterestsContext,
  InterestsContextProvidedValue,
} from '../../../shared/contexts/InterestsContext';
import { LoginContext, LoginContextValue } from '../../../shared/contexts/LoginContext';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { Resources } from '../models/Resources';
import { setVWC } from '../../../shared/lib/setVWC';
import { useDelayedValueWithCallbacks } from '../../../shared/hooks/useDelayedValueWithCallbacks';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useContentWidthValueWithCallbacks } from '../../../shared/lib/useContentWidthValueWithCallbacks';

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
   * viewport.
   */
  contentWidth: ValueWithCallbacks<number>;

  /**
   * The visitor and how they signed up with oseh (i.e, their interests)
   */
  interests: InterestsContextProvidedValue;
};

const areWindowSizesEqual = (a: WindowSize, b: WindowSize): boolean =>
  a.width === b.width && a.height === b.height;

/**
 * Initializes a new screen context that can be used by screens managed by
 * `useScreenQueue`
 */
export const useScreenContext = (): ScreenContext => {
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
  const imageHandler = useOsehImageStateRequestHandler({ cacheSize: 100 });
  const resources = useMemo((): Resources => ({ imageHandler }), [imageHandler]);

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
    }),
    [
      loginContext,
      resources,
      interestsContext,
      windowSizeImmediate,
      windowSizeDebounced,
      contentWidth,
    ]
  );
};
