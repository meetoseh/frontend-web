import {
  createContext,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ModalContext, addModalWithCallbackToRemove } from './ModalContext';
import { ModalWrapper } from './ModalWrapper';
import styles from './FullscreenContext.module.css';
import { useWindowSize } from './hooks/useWindowSize';

export type FullscreenContextValue = {
  /**
   * Whether or not we are currently in fullscreen mode. We must have something
   * on the screen that lets them exit fullscreen mode when this is true.
   */
  fullscreen: boolean;

  /**
   * Whether or not we want to be in fullscreen mode. This is used to determine
   * if a fullscreen prompt might be shown, but is primarily for debugging. We
   * want fullscreen if we have any reason to be in fullscreen. We will exit
   * fullscreen if nothing wants us to be in fullscreen.
   */
  wantsFullscreen: boolean;

  /**
   * Exits full screen immediately, regardless of if we want to be in fullscreen
   * mode. This is treated as if the user was given the fullscreen prompt and
   * chose no, but ask again later.
   */
  exitFullscreen: () => void;

  /**
   * Enters full screen immediately, if it's possible to do so. This is treated
   * as if the user was given the fullscreen prompt and chose yes, but ask again
   * later.
   *
   * This should only be used if we have a button to go full screen on the page
   * and the user clicked that.
   */
  forceFullscreen: () => void;

  /**
   * Adds a reason to be in fullscreen mode, if the reason is not already
   * present. This may cause the wantsFullscreen state to be updated.
   *
   * @param uid If specified, used as the unique identifier of the reason to add.
   *   Otherwise, a random identifier will be generated.
   * @returns The unique identifier of the reason
   */
  addFullscreenReason: (this: void, uid?: string | undefined) => string;

  /**
   * Removes a reason to be in fullscreen mode, if the reason is present. This
   * may cause the wantsFullscreen state to be updated.
   *
   * @param uid The unique identifier of the reason to remove
   */
  removeFullscreenReason: (this: void, uid: string) => void;
};

/**
 * Context which holds the fullscreen state. It's recommended that the
 * FullscreenProvider be used to set this context.
 */
export const FullscreenContext = createContext<FullscreenContextValue>({
  fullscreen: false,
  wantsFullscreen: false,
  exitFullscreen: () => {},
  forceFullscreen: () => {},
  addFullscreenReason: () => '',
  removeFullscreenReason: () => {},
});

/**
 * The state we store in localStorage
 */
type FullscreenPersistedState = {
  /**
   * The permission that the user gave us for fullscreen mode by our
   * request - note this is distinct from browser permissions.
   *
   * In practice, 'always' is not possible on most devices as it must
   * be initiated by user gesture.
   */
  fullscreenPermission: 'prompt' | 'always' | 'never';
};

/**
 * The default state if the persisted state is not in localStorage
 */
const newPersistedState = (): FullscreenPersistedState => ({
  fullscreenPermission: 'prompt',
});

/**
 * Provides the FullscreenContext to the children. This requires itself being
 * in a ModalContext, and is not nestable. It uses localStorage to keep track of
 * preferences.
 */
export const FullscreenProvider = ({ children }: { children: ReactElement }): ReactElement => {
  const modalContext = useContext(ModalContext);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [wantsFullscreen, setWantsFullscreen] = useState<boolean>(false);
  const [fullscreenReasons, setFullscreenReasons] = useState<Set<string>>(new Set());
  const [persistedState, setPersistedState] = useState<FullscreenPersistedState | null>(null);
  const [promptingFullscreen, setPromptingFullscreen] = useState<boolean>(false);
  const fullscreenIsForced = useRef<boolean>(false);
  const attemptedFullscreen = useRef<boolean>(false);
  const [promptResponse, setPromptResponse] = useState<boolean | null>(null);
  const windowSize = useWindowSize();

  const addFullscreenReason = useCallback((uid?: string | undefined): string => {
    const reasonUid =
      uid ?? Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    setFullscreenReasons((reasons) => {
      const newReasons = new Set(reasons);
      newReasons.add(reasonUid);
      return newReasons;
    });
    return reasonUid;
  }, []);

  const removeFullscreenReason = useCallback((uid: string): void => {
    setFullscreenReasons((reasons) => {
      const newReasons = new Set(reasons);
      newReasons.delete(uid);
      return newReasons;
    });
  }, []);

  useEffect(() => {
    setWantsFullscreen(fullscreenReasons.size > 0);
  }, [fullscreenReasons]);

  useEffect(() => {
    if (persistedState !== null) {
      return;
    }

    const persistedStateRaw = localStorage.getItem('oseh-fullscreen-persisted');
    if (persistedStateRaw === null) {
      setPersistedState(newPersistedState());
      return;
    }

    try {
      const loadedPersistedState = JSON.parse(persistedStateRaw) as FullscreenPersistedState;

      const persistedState = Object.assign(newPersistedState(), loadedPersistedState);
      setPersistedState(persistedState);
    } catch (e) {
      console.error(e);
      setPersistedState(newPersistedState());
    }
  }, [persistedState]);

  useEffect(() => {
    if (persistedState === null) {
      return;
    }

    const persistedStateRaw = JSON.stringify(persistedState);
    localStorage.setItem('oseh-fullscreen-persisted', persistedStateRaw);
  }, [persistedState]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const goFullscreen = useCallback(async (): Promise<boolean> => {
    attemptedFullscreen.current = true;
    try {
      if (document.fullscreenElement) {
        return true;
      }
      await document.documentElement.requestFullscreen({
        navigationUI: 'hide',
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      return !!document.fullscreenElement;
    } catch (e) {
      console.error('failed to go fullscreen', e);
      return false;
    } finally {
      setPromptingFullscreen(false);
    }
  }, []);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    attemptedFullscreen.current = false;
    try {
      if (!document.fullscreenElement) {
        return true;
      }

      await document.exitFullscreen();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return !document.fullscreenElement;
    } catch (e) {
      console.error('failed to exit fullscreen', e);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!promptingFullscreen) {
      return;
    }

    const onYesButPromptAgain = async () => {
      const success = await goFullscreen();

      if (success) {
        setPersistedState((oldPersistedState) => {
          const newState = Object.assign(newPersistedState(), oldPersistedState);
          newState.fullscreenPermission = 'prompt';
          return newState;
        });
        setPromptResponse(true);
      } else {
        setPromptResponse(false);
      }
      setPromptingFullscreen(false);
    };

    const onNoButPromptAgain = async () => {
      setPersistedState((oldPersistedState) => {
        const newState = Object.assign(newPersistedState(), oldPersistedState);
        newState.fullscreenPermission = 'prompt';
        return newState;
      });
      setPromptResponse(false);
      setPromptingFullscreen(false);
    };

    const onNoDontPromptAgain = () => {
      setPersistedState((oldPersistedState) => {
        const newState = Object.assign(newPersistedState(), oldPersistedState);
        newState.fullscreenPermission = 'never';
        return newState;
      });
      setPromptResponse(false);
      setPromptingFullscreen(false);
    };

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setPromptingFullscreen(false)}>
        <div className={styles.prompt}>
          <div className={styles.promptTitle}>Go fullscreen?</div>
          <div className={styles.promptResponses}>
            <button className={styles.promptButton} type="button" onClick={onYesButPromptAgain}>
              Yes, and always prompt
            </button>
            <button className={styles.promptButton} type="button" onClick={onNoButPromptAgain}>
              No, and always prompt
            </button>
            <button className={styles.promptButton} type="button" onClick={onNoDontPromptAgain}>
              No, and don't prompt again
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }, [promptingFullscreen, modalContext.setModals, goFullscreen]);

  useEffect(() => {
    if (
      !window.document ||
      !document.documentElement ||
      !document.documentElement.requestFullscreen
    ) {
      return;
    }

    if ((document as any).featurePolicy) {
      try {
        const policy: any = (document as any).featurePolicy;
        if (policy.features && policy.allowsFeature) {
          const features: string[] = policy.features();
          if (features.includes('fullscreen') && !policy.allowsFeature('fullscreen')) {
            return;
          }
        }
      } catch (e) {
        console.error("error polling feature policy: 'fullscreen'", e);
      }
    }

    if (!wantsFullscreen) {
      exitFullscreen();
      return;
    }

    if (promptingFullscreen) {
      return;
    }

    // don't fullscreen on large screens it doesn't help
    if (windowSize.width > 600 && windowSize.height > 900) {
      if (fullscreen) {
        exitFullscreen();
      }
      return;
    }

    if (attemptedFullscreen.current || fullscreenIsForced.current) {
      return;
    }

    if (promptResponse === false) {
      return;
    }

    if (persistedState?.fullscreenPermission === 'always') {
      goFullscreen();
      return;
    }

    if (persistedState?.fullscreenPermission === 'never') {
      return;
    }

    setPromptingFullscreen(true);
  }, [
    fullscreen,
    wantsFullscreen,
    persistedState?.fullscreenPermission,
    windowSize,
    goFullscreen,
    exitFullscreen,
    promptResponse,
    promptingFullscreen,
  ]);

  const forceGoFullscreen = useCallback(async () => {
    fullscreenIsForced.current = true;
    try {
      await goFullscreen();
    } finally {
      setPersistedState((oldPersistedState) => {
        const newState = Object.assign(newPersistedState(), oldPersistedState);
        if (newState.fullscreenPermission === 'never') {
          newState.fullscreenPermission = 'prompt';
        }
        return newState;
      });
    }
  }, [goFullscreen]);

  const forceExitFullscreen = useCallback(async () => {
    fullscreenIsForced.current = true;
    try {
      await exitFullscreen();
    } finally {
      setPersistedState((oldPersistedState) => {
        const newState = Object.assign(newPersistedState(), oldPersistedState);
        if (newState.fullscreenPermission === 'always') {
          newState.fullscreenPermission = 'prompt';
        }
        return newState;
      });
    }
  }, [exitFullscreen]);

  const value = useMemo(
    (): FullscreenContextValue => ({
      fullscreen,
      wantsFullscreen,
      addFullscreenReason,
      removeFullscreenReason,
      forceFullscreen: forceGoFullscreen,
      exitFullscreen: forceExitFullscreen,
    }),
    [
      fullscreen,
      wantsFullscreen,
      addFullscreenReason,
      removeFullscreenReason,
      forceGoFullscreen,
      forceExitFullscreen,
    ]
  );

  return <FullscreenContext.Provider value={value}>{children}</FullscreenContext.Provider>;
};
