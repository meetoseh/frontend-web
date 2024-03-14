import { useCallback, useContext } from 'react';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { GotoEmotionResources } from './GotoEmotionResources';
import { GotoEmotionState, ShowEmotion } from './GotoEmotionState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { adaptActiveVWCToAbortSignal } from '../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { setVWC } from '../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../shared/ApiConstants';
import { Emotion } from '../pickEmotionJourney/Emotion';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useNetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { emotionJourneyKeyMap } from './EmotionJourney';
import { GotoEmotion } from './GotoEmotion';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';

export const GotoEmotionFeature: Feature<GotoEmotionState, GotoEmotionResources> = {
  identifier: 'gotoEmotion',
  useWorldState: () => {
    const loginContextRaw = useContext(LoginContext);
    const tryingEmotionWordVWC = useWritableValueWithCallbacks<string | null>(() => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      if (!path.startsWith('/emotions/')) {
        return null;
      }
      const emotionWord = path.substring('/emotions/'.length);
      if (emotionWord.includes('/')) {
        return null;
      }
      return emotionWord;
    });
    const showVWC = useWritableValueWithCallbacks<ShowEmotion | null | undefined>(() => undefined);

    useValueWithCallbacksEffect(loginContextRaw.value, (loginContextUnch) => {
      if (loginContextUnch.state !== 'logged-in') {
        return undefined;
      }
      const loginContext = loginContextUnch;

      if (showVWC.get() !== undefined) {
        return;
      }

      const wordUnch = tryingEmotionWordVWC.get();
      if (wordUnch === null) {
        setVWC(showVWC, null);
        return undefined;
      }
      const word = wordUnch;
      const active = createWritableValueWithCallbacks(true);
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        if (!active.get()) {
          return;
        }

        try {
          const response = await apiFetch(
            '/api/1/emotions/?word=' + encodeURIComponent(word),
            {
              method: 'GET',
              signal,
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          const emotion: Emotion = await response.json();
          if (active.get()) {
            setVWC(showVWC, { emotion, anticipatory: false });
            setVWC(tryingEmotionWordVWC, null);
          }
        } catch (e) {
          console.error('error fetching association emotion', e);
          if (active.get()) {
            setVWC(showVWC, null);
            setVWC(tryingEmotionWordVWC, null);
          }
        }
      });
      return () => {
        setVWC(active, false);
      };
    });

    const setShow = useCallback(
      (show: ShowEmotion | null, updateWindowHistory: boolean) => {
        const current = showVWC.get();
        if (current === undefined) {
          throw new Error('GotoEmotionFeature: setShow called when show is undefined');
        }

        setVWC(showVWC, show);

        if (updateWindowHistory) {
          if (show === null) {
            window.history.pushState(null, '', '/');
          } else {
            window.history.pushState(null, '', '/emotions/' + show.emotion.word);
          }
        }
      },
      [showVWC]
    );

    return useMappedValuesWithCallbacks([showVWC], () => {
      return {
        show: showVWC.get(),
        setShow,
      };
    });
  },
  isRequired: (state) => {
    if (state.show === undefined) {
      return undefined;
    }
    return state.show !== null && !state.show.anticipatory;
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const loginContextRaw = useContext(LoginContext);
    const loadingVWC = useMappedValueWithCallbacks(
      stateVWC,
      (s) => (s.show !== null && s.show !== undefined ? s.show.emotion : null),
      {
        outputEqualityFn: (a, b) => (a === null || b === null ? a === b : a.word === b.word),
      }
    );
    const loadPreventedVWC = useMappedValueWithCallbacks(loadingVWC, (v) => v === null);
    const freeEmotionJourneyNR = useNetworkResponse(
      (active, loginContext) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          if (!active.get()) {
            return null;
          }

          const emotion = loadingVWC.get();
          if (emotion === null) {
            return null;
          }

          const response = await apiFetch(
            '/api/1/emotions/start_related_journey',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                emotion: emotion.word,
                replaced_emotion_user_uid: null,
                premium: false,
              }),
              signal,
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const parsed = convertUsingMapper(data, emotionJourneyKeyMap);
          return parsed;
        }),
      { loadPrevented: loadPreventedVWC, minRefreshTimeMS: 0, dependsOn: [loadingVWC] }
    );
    const haveProNR = useNetworkResponse(
      (active, loginContext) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          const response = await apiFetch(
            '/api/1/users/me/entitlements/pro',
            {
              method: 'GET',
              signal,
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          const data: { is_active: boolean } = await response.json();
          return data.is_active;
        }),
      { loadPrevented: loadPreventedVWC }
    );
    const premiumClassPreventedVWC = useMappedValuesWithCallbacks(
      [loadPreventedVWC, haveProNR],
      () => {
        const loadPrevented = loadPreventedVWC.get();
        if (loadPrevented) {
          return true;
        }

        const havePro = haveProNR.get();
        return havePro.type !== 'success' || !havePro.result;
      }
    );
    const premiumEmotionJourneyNR = useNetworkResponse(
      (active, loginContext) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          if (!active.get()) {
            return null;
          }

          const emotion = loadingVWC.get();
          if (emotion === null) {
            return null;
          }

          const response = await apiFetch(
            '/api/1/emotions/start_related_journey',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                emotion: emotion.word,
                replaced_emotion_user_uid: null,
                premium: true,
              }),
              signal,
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const parsed = convertUsingMapper(data, emotionJourneyKeyMap);
          return parsed;
        }),
      { loadPrevented: premiumClassPreventedVWC, minRefreshTimeMS: 0, dependsOn: [loadingVWC] }
    );
    const imageHandler = useOsehImageStateRequestHandler({});
    const socialProofPicturesVWC = useWritableValueWithCallbacks<OsehImageState[]>(() => []);

    useValueWithCallbacksEffect(freeEmotionJourneyNR, (freeEmotionJourney) => {
      if (freeEmotionJourney.type !== 'success') {
        setVWC(socialProofPicturesVWC, []);
        return undefined;
      }

      const refs = freeEmotionJourney.result.voterPictures;
      const requests = refs.map((ref) =>
        imageHandler.request({
          uid: ref.uid,
          jwt: ref.jwt,
          displayWidth: 24,
          displayHeight: 24,
          alt: '',
        })
      );
      const active = createWritableValueWithCallbacks(true);

      requests.forEach((r) => r.stateChanged.add(handleStateChanged));
      const cleanupRequests = () => {
        requests.forEach((r) => {
          r.stateChanged.remove(handleStateChanged);
          r.release();
        });
        active.callbacks.remove(cleanupRequests);
      };
      active.callbacks.add(cleanupRequests);
      handleStateChanged();

      return () => {
        setVWC(active, false);
      };

      function handleStateChanged() {
        setVWC(
          socialProofPicturesVWC,
          requests.map((r) => r.state)
        );
      }
    });

    return useMappedValuesWithCallbacks(
      [
        requiredVWC,
        freeEmotionJourneyNR,
        haveProNR,
        premiumEmotionJourneyNR,
        socialProofPicturesVWC,
      ],
      (): GotoEmotionResources => {
        const req = requiredVWC.get();
        const freeEmotionJourney = freeEmotionJourneyNR.get();
        const havePro = haveProNR.get();
        const premiumEmotionJourney = premiumEmotionJourneyNR.get();
        const socialProofPictures = socialProofPicturesVWC.get();

        return {
          loading:
            !req ||
            freeEmotionJourney.type !== 'success' ||
            havePro.type !== 'success' ||
            (havePro.result && premiumEmotionJourney.type !== 'success'),
          freeEmotionJourney,
          havePro,
          premiumEmotionJourney,
          socialProofPictures,
          onBack: () => {
            stateVWC.get().setShow(null, true);
          },
          onTakeFreeJourney: () => {
            if (freeEmotionJourney.type !== 'success') {
              return;
            }
            const show = stateVWC.get().show;
            if (show === null || show === undefined) {
              return;
            }

            allStatesVWC.get().singleJourney.setShow({
              type: 'emotion',
              ref: freeEmotionJourney.result.journey,
              emotion: show.emotion,
            });
            stateVWC.get().setShow(null, true);

            (async () => {
              const loginContextUnch = loginContextRaw.value.get();
              if (loginContextUnch.state !== 'logged-in') {
                return;
              }
              const loginContext = loginContextUnch;
              await apiFetch(
                '/api/1/emotions/started_related_journey',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json; charset=utf-8' },
                  body: JSON.stringify({
                    emotion_user_uid: freeEmotionJourney.result.emotionUserUid,
                  }),
                },
                loginContext
              );
            })();
          },
          onTakePremiumJourney: () => {
            const show = stateVWC.get().show;
            if (show === null || show === undefined) {
              return;
            }

            if (!havePro.result) {
              allStatesVWC.get().upgrade.setContext(
                {
                  type: 'longerClasses',
                  emotion: show.emotion.word,
                },
                true
              );
              stateVWC.get().setShow(null, false);
              return;
            }

            if (premiumEmotionJourney.type !== 'success') {
              return;
            }

            allStatesVWC.get().singleJourney.setShow({
              type: 'emotion',
              ref: premiumEmotionJourney.result.journey,
              emotion: show.emotion,
            });
            stateVWC.get().setShow(null, true);

            (async () => {
              const loginContextUnch = loginContextRaw.value.get();
              if (loginContextUnch.state !== 'logged-in') {
                return;
              }
              const loginContext = loginContextUnch;
              await apiFetch(
                '/api/1/emotions/started_related_journey',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json; charset=utf-8' },
                  body: JSON.stringify({
                    emotion_user_uid: premiumEmotionJourney.result.emotionUserUid,
                  }),
                },
                loginContext
              );
            })();
          },
        };
      }
    );
  },
  component: (state, resources) => <GotoEmotion state={state} resources={resources} />,
};
