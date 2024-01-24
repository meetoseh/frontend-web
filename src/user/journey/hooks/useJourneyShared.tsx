import { useContext, useEffect } from 'react';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { JourneyRef } from '../models/JourneyRef';
import { JourneyShared } from '../models/JourneyShared';
import { LoginContext, LoginContextValueUnion } from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { fetchWebExport } from '../../../shared/content/useOsehContentTarget';
import { useOsehAudioContentState } from '../../../shared/content/useOsehAudioContentState';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehContentTarget } from '../../../shared/content/OsehContentTarget';

/**
 * Creates the initial journey & journey start shared state. Since this is often
 * used right as an animation is starting, we try very hard to reduce the number
 * of react rerenders this triggers. This wasn't done until it became clear that
 * every react rerender was very obvious to the user.
 *
 * @param journey The journey to create the shared state for
 */
export const useJourneyShared = (
  journeyVariableStrategy: VariableStrategyProps<JourneyRef | null>
): ValueWithCallbacks<JourneyShared> => {
  const loginContextRaw = useContext(LoginContext);
  const journeyVWC = useVariableStrategyPropsAsValueWithCallbacks(journeyVariableStrategy);
  const windowSizeVWC = useWindowSizeValueWithCallbacks({
    type: 'react-rerender',
    props: undefined,
  });

  const imageHandler = useOsehImageStateRequestHandler({});
  const result = useWritableValueWithCallbacks<JourneyShared>(() =>
    createLoadingJourneyShared(windowSizeVWC.get())
  );

  const targetVWC = useWritableValueWithCallbacks<OsehContentTarget>(() => ({
    state: 'loading',
    jwt: null,
    error: null,
    webExport: null,
    presigned: null,
  }));
  const audioVWC = useOsehAudioContentState({
    type: 'callbacks',
    props: targetVWC.get,
    callbacks: targetVWC.callbacks,
  });

  // holy callback hell
  // this is surprisingly efficient despite looking like a mess
  useEffect(() => {
    let managedJourneyUID: string | null = null;
    let unmountJourneyHandler: (() => void) | null = null;
    journeyVWC.callbacks.add(handleJourneyChanged);
    loginContextRaw.value.callbacks.add(handleJourneyChanged);
    handleJourneyChanged();
    return () => {
      journeyVWC.callbacks.remove(handleJourneyChanged);
      loginContextRaw.value.callbacks.remove(handleJourneyChanged);
      if (unmountJourneyHandler !== null) {
        unmountJourneyHandler();
        unmountJourneyHandler = null;
      }
    };

    function handleJourneyChanged(): void {
      if (unmountJourneyHandler !== null) {
        unmountJourneyHandler();
        unmountJourneyHandler = null;
      }

      const journeyOuter = journeyVWC.get();
      if (journeyOuter === null) {
        unmountJourneyHandler = handlePerpetualLoading();
        return;
      }

      if (managedJourneyUID !== journeyOuter.uid) {
        result.set(createLoadingJourneyShared(windowSizeVWC.get()));
        result.callbacks.call(undefined);
        managedJourneyUID = journeyOuter.uid;
      }

      unmountJourneyHandler = handleJourney(journeyOuter, loginContextRaw.value.get());
    }

    function handleJourney(
      journey: JourneyRef,
      loginContextUnch: LoginContextValueUnion
    ): () => void {
      const cleanup = [
        handleDarkenedAndBlurredImages(),
        handleContentTarget(),
        handleAudio(),
        handleFavorited(),
      ];
      return () => {
        cleanup.forEach((fn) => fn());
      };

      function handleDarkenedAndBlurredImages(): () => void {
        let removeRequest: (() => void) | null = null;
        windowSizeVWC.callbacks.add(update);
        update();

        return () => {
          windowSizeVWC.callbacks.remove(update);
          if (removeRequest !== null) {
            removeRequest();
            removeRequest = null;
          }
        };

        function update() {
          if (removeRequest !== null) {
            removeRequest();
            removeRequest = null;
          }

          const darkenedRequest = imageHandler.request({
            uid: journey.darkenedBackgroundImage.uid,
            jwt: journey.darkenedBackgroundImage.jwt,
            displayWidth: windowSizeVWC.get().width,
            displayHeight: windowSizeVWC.get().height,
            alt: '',
          });
          const blurredRequest = imageHandler.request({
            uid: journey.blurredBackgroundImage.uid,
            jwt: journey.blurredBackgroundImage.jwt,
            displayWidth: windowSizeVWC.get().width,
            displayHeight: windowSizeVWC.get().height,
            alt: '',
          });

          darkenedRequest.stateChanged.add(handleImageStateChanged);
          blurredRequest.stateChanged.add(handleImageStateChanged);
          removeRequest = () => {
            darkenedRequest.stateChanged.remove(handleImageStateChanged);
            blurredRequest.stateChanged.remove(handleImageStateChanged);
            darkenedRequest.release();
            blurredRequest.release();
          };
          handleImageStateChanged();

          function handleImageStateChanged() {
            if (darkenedRequest.state.loading && blurredRequest.state.loading) {
              return;
            }

            if (!darkenedRequest.state.loading) {
              result.set({
                ...result.get(),
                darkenedImage: darkenedRequest.state,
              });
            }

            if (!blurredRequest.state.loading) {
              result.set({
                ...result.get(),
                blurredImage: blurredRequest.state,
              });
            }

            result.callbacks.call(undefined);
          }
        }
      }

      function handleContentTarget(): () => void {
        let active = true;
        fetchContentTarget();
        return () => {
          active = false;
        };

        async function fetchContentTarget() {
          const oldTarget = targetVWC.get();
          if (oldTarget.jwt === journey.audioContent.jwt && oldTarget.webExport !== null) {
            return;
          }

          if (journey.audioContent.uid === null || journey.audioContent.jwt === null) {
            return;
          }

          try {
            const webExport = await fetchWebExport(
              journey.audioContent.uid,
              journey.audioContent.jwt,
              false
            );
            if (!active) {
              return;
            }
            targetVWC.set({
              state: 'loaded',
              jwt: journey.audioContent.jwt,
              error: null,
              webExport,
              presigned: false,
            });
            targetVWC.callbacks.call(undefined);
          } catch (e) {
            console.error('error fetching content target', e);
          }
        }
      }

      function handleAudio(): () => void {
        audioVWC.callbacks.add(update);
        update();
        return () => {
          audioVWC.callbacks.remove(update);
        };

        function update() {
          result.set({
            ...result.get(),
            audio: audioVWC.get(),
          });
          result.callbacks.call(undefined);
        }
      }

      function handleFavorited(): () => void {
        let active = true;
        loadFavorited();
        return () => {
          active = false;
        };

        async function loadFavoritedInner() {
          if (!active) {
            return;
          }
          if (loginContextUnch.state === 'loading') {
            setFavorited(null);
            return;
          }

          if (loginContextUnch.state === 'logged-out') {
            setFavorited(false);
            return;
          }

          if (result.get().favorited !== null) {
            return;
          }

          const response = await apiFetch(
            '/api/1/users/me/search_history',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                filters: {
                  uid: {
                    operator: 'eq',
                    value: journey.uid,
                  },
                  liked_at: {
                    operator: 'neq',
                    value: null,
                  },
                },
                limit: 1,
              }),
            },
            loginContextUnch
          );
          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const isFavorited = data.items.length >= 1;
          setFavorited(isFavorited);
        }

        async function loadFavorited() {
          try {
            await loadFavoritedInner();
          } catch (e) {
            console.error('error loading favorited, assuming not favorited', e);
            setFavorited(false);
          }
        }

        function setFavorited(v: boolean | null) {
          if (result.get().favorited !== v) {
            result.set({
              ...result.get(),
              favorited: v,
              setFavorited:
                v === null
                  ? () => {
                      throw new Error('cannot set favorited while loading');
                    }
                  : setFavorited,
            });
            result.callbacks.call(undefined);
          }
        }
      }
    }

    function handlePerpetualLoading(): () => void {
      windowSizeVWC.callbacks.add(update);

      return () => {
        windowSizeVWC.callbacks.remove(update);
      };

      function update() {
        result.set(createLoadingJourneyShared(windowSizeVWC.get()));
      }
    }
  }, [journeyVWC, windowSizeVWC, loginContextRaw, audioVWC, imageHandler, result, targetVWC]);

  return result;
};

/**
 * Creates a loading-state of journey shared, appropriate when you don't have a
 * real journey shared available.
 *
 * @param windowSize The size of the window
 * @param feedbackSize The size of the darkened image on the feedback screen
 * @returns A loading-state of journey shared
 */
export const createLoadingJourneyShared = (windowSize: {
  width: number;
  height: number;
}): JourneyShared => ({
  darkenedImage: {
    localUrl: null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    loading: true,
    thumbhash: null,
  },
  blurredImage: {
    localUrl: null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    loading: true,
    thumbhash: null,
  },
  audio: {
    play: null,
    stop: null,
    loaded: false,
    audio: null,
    error: null,
  },
  favorited: null,
  setFavorited: () => {
    throw new Error('cannot setFavorited while favorited is null');
  },
});
