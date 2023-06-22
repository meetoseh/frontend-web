import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Feature } from '../../models/Feature';
import { PickEmotionJourneyResources } from './PickEmotionJourneyResources';
import { PickEmotionJourneyState } from './PickEmotionJourneyState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { JourneyRef, journeyRefKeyMap } from '../../../journey/models/JourneyRef';
import { useJourneyShared } from '../../../journey/hooks/useJourneyShared';
import { useSingletonEffect } from '../../../../shared/lib/useSingletonEffect';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { Emotion } from './Emotion';
import { convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { PickEmotionJourney } from './PickEmotionJourney';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { useMyProfilePictureState } from '../../../../shared/hooks/useMyProfilePicture';

export const PickEmotionJourneyFeature: Feature<
  PickEmotionJourneyState,
  PickEmotionJourneyResources
> = {
  identifier: 'pickEmotionJourney',
  useWorldState: () => {
    const [classesTakenThisSession, setClassesTakenThisSession] = useState<number>(0);
    const [recentlyViewed, setRecentlyViewed] = useState<
      { clientUid: string; words: Emotion[]; at: Date; selected: Emotion | null }[]
    >([]);

    const onViewed = useCallback((words: Emotion[]) => {
      const now = new Date();
      const uid =
        'osehc_words_' + Math.random().toString(36).substring(2) + now.getTime().toString(36);
      setRecentlyViewed((prev) =>
        [...prev, { clientUid: uid, words, at: now, selected: null }].slice(-5)
      );
      return uid;
    }, []);

    const onSelection = useCallback((clientUid: string, selected: Emotion) => {
      setRecentlyViewed((prev) => {
        const result: {
          clientUid: string;
          words: Emotion[];
          at: Date;
          selected: Emotion | null;
        }[] = [];
        for (const r of prev) {
          if (r.clientUid === clientUid) {
            const newSelected = r.words.find((w) => w.word === selected.word);
            if (newSelected === undefined) {
              throw new Error('Selected emotion not found in words');
            }
            result.push({ ...r, selected: newSelected });
          } else {
            result.push(r);
          }
        }
        return result;
      });
    }, []);

    const onFinishedClass = useCallback(() => {
      setClassesTakenThisSession((prev) => prev + 1);
    }, []);

    return useMemo<PickEmotionJourneyState>(
      () => ({
        classesTakenThisSession,
        recentlyViewed,
        onViewed,
        onSelection,
        onFinishedClass,
      }),
      [classesTakenThisSession, recentlyViewed, onViewed, onSelection, onFinishedClass]
    );
  },
  useResources: (state, required, allStates) => {
    const loginContext = useContext(LoginContext);
    const [optionsCounter, setOptionsCounter] = useState(0);
    const [options, setOptions] = useState<{
      ctr: number;
      clientUid: string;
      words: Emotion[];
    } | null>(null);
    const [selected, setSelected] = useState<{
      ctr: number;
      word: Emotion;
      emotionUserUid: string;
      journey: JourneyRef;
      numVotes: number;
      numTotalVotes: number;
      profilePictures: OsehImageRef[];
      skipsStats: boolean;
    } | null>(null);
    const journeyShared = useJourneyShared(selected === null ? null : selected.journey);
    const images = useOsehImageStateRequestHandler({});
    const [profilePictures, setProfilePictures] = useState<OsehImageState[]>([]);
    const [error, setError] = useState<{ ctr: number; value: ReactElement } | null>(null);
    const windowSize = useWindowSize();
    const background = useOsehImageState(
      {
        uid: required ? 'oseh_if_0ykGW_WatP5-mh-0HRsrNw' : null,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      },
      images
    );
    const profilePicture = useMyProfilePictureState({
      loginContext,
      displayWidth: 60,
      displayHeight: 60,
      handler: images,
      load: required,
    });
    const [forceSplash, setForceSplash] = useState<boolean>(false);
    const [isOnboarding, setIsOnboarding] = useState<boolean>(() => {
      return localStorage.getItem('onboard') === '1';
    });

    useSingletonEffect(
      (onDone) => {
        if (!required) {
          if (options !== null || error !== null) {
            setOptions(null);
            setError(null);
            setSelected(null);
          }
          onDone();
          return;
        }
        if (error !== null && error.ctr === optionsCounter) {
          onDone();
          return;
        }

        if (options !== null && options.ctr === optionsCounter) {
          onDone();
          return;
        }

        if (loginContext.state !== 'logged-in') {
          onDone();
          return;
        }

        let active = true;
        fetchOptions();
        return () => {
          active = false;
        };

        async function fetchOptionsInner() {
          const now = new Date();
          const response = await apiFetch(
            '/api/1/emotions/personalized',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                recently_seen: state.recentlyViewed
                  .slice(-5)
                  .map((r) => r.words.map((w) => w.word)),
                local_time: {
                  hour_24: now.getHours(),
                  minute: now.getMinutes(),
                },
                num_emotions: 12,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const emotions: Emotion[] = data.items;
          if (active) {
            const uid = state.onViewed.call(undefined, emotions);
            setOptions({ ctr: optionsCounter, clientUid: uid, words: emotions });
          }
        }

        async function fetchOptions() {
          try {
            await fetchOptionsInner();
          } catch (e) {
            const err = await describeError(e);
            if (active) {
              setError({ ctr: optionsCounter, value: err });
            }
          } finally {
            onDone();
          }
        }
      },
      [error, options, optionsCounter, loginContext, state.onViewed, required]
    );

    const onSelect = useCallback(
      async (word: Emotion, skipsStats?: boolean, replacedEmotionUserUid?: string | null) => {
        if (
          options === null ||
          options.ctr !== optionsCounter ||
          !options.words.some((w) => w === word) ||
          loginContext.state !== 'logged-in'
        ) {
          return;
        }

        if (replacedEmotionUserUid === undefined) {
          if (selected === null || selected.ctr !== optionsCounter) {
            replacedEmotionUserUid = null;
          } else {
            replacedEmotionUserUid = selected.emotionUserUid;
          }
        }

        try {
          const response = await apiFetch(
            '/api/1/emotions/start_related_journey',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                emotion: word.word,
                replaced_emotion_user_uid: replacedEmotionUserUid,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const journey = convertUsingKeymap(data.journey, journeyRefKeyMap);
          const numVotes = data.num_votes as number;
          const numTotalVotes = data.num_total_votes as number;
          const voterPictures = data.voter_pictures as OsehImageRef[];
          const emotionUserUid = data.emotion_user_uid as string;

          setSelected({
            ctr: optionsCounter,
            word,
            emotionUserUid,
            journey,
            numVotes,
            numTotalVotes,
            profilePictures: voterPictures,
            skipsStats: skipsStats ?? false,
          });
        } catch (e) {
          const err = await describeError(e);
          setError({ ctr: optionsCounter, value: err });
        }
      },
      [loginContext, options, optionsCounter, selected]
    );

    useEffect(() => {
      if (selected?.profilePictures === undefined) {
        return;
      }
      const refs = selected.profilePictures;
      const requests = refs.map((ref) =>
        images.request({
          uid: ref.uid,
          jwt: ref.jwt,
          displayWidth: 38,
          displayHeight: 38,
          alt: '',
          placeholderColor: '#cccccc',
        })
      );
      for (let r of requests) {
        r.stateChanged.add(handleStateChanged);
      }
      handleStateChanged();

      return () => {
        setProfilePictures([]);
        for (let r of requests) {
          r.stateChanged.remove(handleStateChanged);
          r.release();
        }
      };

      function handleStateChanged() {
        setProfilePictures(requests.map((r) => r.state));
      }
    }, [selected?.profilePictures, images]);

    const onFinishedJourney = useCallback(() => {
      setOptionsCounter((c) => c + 1);
      if (isOnboarding) {
        localStorage.removeItem('onboard');
        setIsOnboarding(false);
      }
    }, [isOnboarding]);

    const takeAnotherClass = useCallback(async () => {
      if (selected === null) {
        setOptionsCounter((c) => c + 1);
        return;
      }

      setForceSplash(true);
      setSelected(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      onSelect(selected.word, true, null);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setForceSplash(false);
    }, [selected, onSelect]);

    return useMemo<PickEmotionJourneyResources>(() => {
      const realError = error === null || error.ctr !== optionsCounter ? null : error.value;
      const realOptions = options === null || options.ctr !== optionsCounter ? null : options;
      const realSelected = selected === null || selected.ctr !== optionsCounter ? null : selected;
      return {
        loading: realError === null && (realOptions === null || background.loading),
        error: realError,
        profilePicture,
        options:
          realError !== null || realOptions === null
            ? null
            : {
                clientUid: realOptions.clientUid,
                words: realOptions.words,
              },
        selected:
          realError !== null || realSelected === null
            ? null
            : {
                word: realSelected.word,
                emotionUserUid: realSelected.emotionUserUid,
                journey: realSelected.journey,
                shared: journeyShared,
                numVotes: realSelected.numVotes,
                numTotalVotes: realSelected.numTotalVotes,
                profilePictures,
                skipsStats: realSelected.skipsStats,
              },
        background: background,
        forceSplash,
        isOnboarding,
        onSelect,
        onFinishedJourney,
        takeAnotherClass,
      };
    }, [
      optionsCounter,
      error,
      profilePicture,
      options,
      selected,
      journeyShared,
      profilePictures,
      background,
      forceSplash,
      isOnboarding,
      onSelect,
      onFinishedJourney,
      takeAnotherClass,
    ]);
  },
  isRequired: () => true,
  component: (state, resources, doAnticipateState) => (
    <PickEmotionJourney state={state} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
