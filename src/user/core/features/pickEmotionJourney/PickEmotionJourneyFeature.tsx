import { MutableRefObject, ReactElement, useCallback, useContext, useEffect, useRef } from 'react';
import { Feature } from '../../models/Feature';
import { PickEmotionJourneyResources } from './PickEmotionJourneyResources';
import { PickEmotionJourneyState } from './PickEmotionJourneyState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { JourneyRef, journeyRefKeyMap } from '../../../journey/models/JourneyRef';
import { useJourneyShared } from '../../../journey/hooks/useJourneyShared';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { Emotion } from './Emotion';
import { convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { PickEmotionJourney } from './PickEmotionJourney';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { useMyProfilePictureStateValueWithCallbacks } from '../../../../shared/hooks/useMyProfilePicture';
import { Callbacks, useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';

type Selected = {
  word: Emotion;
  emotionUserUid: string;
  journey: JourneyRef;
  numVotes: number;
  numTotalVotes: number;
  profilePictures: OsehImageRef[];
  skipsStats: boolean;
};

export const PickEmotionJourneyFeature: Feature<
  PickEmotionJourneyState,
  PickEmotionJourneyResources
> = {
  identifier: 'pickEmotionJourney',
  useWorldState: () => {
    const classesTakenThisSessionVWC = useWritableValueWithCallbacks<number>(() => 0);
    const recentlyViewedVWC = useWritableValueWithCallbacks<
      { clientUid: string; words: Emotion[]; at: Date; selected: Emotion | null }[]
    >(() => []);

    const onViewed = useCallback(
      (words: Emotion[]) => {
        const now = new Date();
        const uid =
          'osehc_words_' + Math.random().toString(36).substring(2) + now.getTime().toString(36);
        recentlyViewedVWC.set(
          [...recentlyViewedVWC.get(), { clientUid: uid, words, at: now, selected: null }].slice(-5)
        );
        recentlyViewedVWC.callbacks.call(undefined);
        return uid;
      },
      [recentlyViewedVWC]
    );

    const onSelection = useCallback(
      (clientUid: string, selected: Emotion) => {
        const prev = recentlyViewedVWC.get();
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

        recentlyViewedVWC.set(result);
        recentlyViewedVWC.callbacks.call(undefined);
      },
      [recentlyViewedVWC]
    );

    const onFinishedClass = useCallback(() => {
      classesTakenThisSessionVWC.set(classesTakenThisSessionVWC.get() + 1);
      classesTakenThisSessionVWC.callbacks.call(undefined);
    }, [classesTakenThisSessionVWC]);

    const onViewedVWC = useReactManagedValueAsValueWithCallbacks(onViewed);
    const onSelectionVWC = useReactManagedValueAsValueWithCallbacks(onSelection);
    const onFinishedClassVWC = useReactManagedValueAsValueWithCallbacks(onFinishedClass);

    return useMappedValuesWithCallbacks(
      [
        classesTakenThisSessionVWC,
        recentlyViewedVWC,
        onViewedVWC,
        onSelectionVWC,
        onFinishedClassVWC,
      ],
      () => ({
        classesTakenThisSession: classesTakenThisSessionVWC.get(),
        recentlyViewed: recentlyViewedVWC.get(),
        onViewed: onViewedVWC.get(),
        onSelection: onSelectionVWC.get(),
        onFinishedClass: onFinishedClassVWC.get(),
      })
    );
  },
  useResources: (stateVWC, requiredVWC, allStates) => {
    const loginContext = useContext(LoginContext);
    const optionsVWC = useWritableValueWithCallbacks<{
      clientUid: string;
      words: Emotion[];
    } | null>(() => null);
    const selectedVWC = useWritableValueWithCallbacks<Selected | null>(() => null);
    const journeySharedVWC = useJourneyShared({
      type: 'callbacks',
      props: () => selectedVWC.get()?.journey ?? null,
      callbacks: selectedVWC.callbacks,
    });
    const images = useOsehImageStateRequestHandler({});
    const profilePicturesVWC = useWritableValueWithCallbacks<OsehImageState[]>(() => []);
    const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
    const windowSizeVWC = useWindowSizeValueWithCallbacks();
    const backgroundPropsVWC = useMappedValuesWithCallbacks(
      [requiredVWC, windowSizeVWC],
      (): OsehImageProps => {
        return {
          uid: requiredVWC.get() ? 'oseh_if_0ykGW_WatP5-mh-0HRsrNw' : null,
          jwt: null,
          displayWidth: windowSizeVWC.get().width,
          displayHeight: windowSizeVWC.get().height,
          alt: '',
          isPublic: true,
        };
      }
    );
    const backgroundVWC = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => backgroundPropsVWC.get(),
        callbacks: backgroundPropsVWC.callbacks,
      },
      images
    );
    const loginContextRaw = useContext(LoginContext);
    const loginContextVWC = useReactManagedValueAsValueWithCallbacks(loginContextRaw);
    const profilePictureProps = useMappedValuesWithCallbacks(
      [requiredVWC, loginContextVWC],
      () => ({
        loginContext: loginContextVWC.get(),
        displayWidth: 45,
        displayHeight: 45,
        handler: images,
        load: requiredVWC.get(),
      })
    );
    const profilePictureVWC = useMyProfilePictureStateValueWithCallbacks({
      type: 'callbacks',
      props: () => profilePictureProps.get(),
      callbacks: profilePictureProps.callbacks,
    });
    const forceSplashVWC = useWritableValueWithCallbacks<boolean>(() => false);
    const isOnboardingVWC = useWritableValueWithCallbacks<boolean>(() => {
      return localStorage.getItem('onboard') === '1';
    });

    const reloadEmotions = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;
    if (reloadEmotions.current === undefined) {
      reloadEmotions.current = new Callbacks();
    }

    useEffect(() => {
      let cleanup: (() => void) | null = null;
      reloadEmotions.current.add(handlePropsChanged);
      handlePropsChanged();
      return () => {
        reloadEmotions.current.remove(handlePropsChanged);
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
      };

      function handleProps(): () => void {
        let active = true;
        fetchOptions();
        return () => {
          active = false;
        };

        async function fetchOptionsInner() {
          selectedVWC.set(null);
          selectedVWC.callbacks.call(undefined);
          optionsVWC.set(null);
          optionsVWC.callbacks.call(undefined);

          const now = new Date();
          const response = await apiFetch(
            '/api/1/emotions/personalized',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                recently_seen: stateVWC
                  .get()
                  .recentlyViewed.slice(-5)
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
            const uid = stateVWC.get().onViewed.call(undefined, emotions);
            optionsVWC.set({ clientUid: uid, words: emotions });
            optionsVWC.callbacks.call(undefined);
          }
        }

        async function fetchOptions() {
          if (loginContext.state !== 'logged-in') {
            return;
          }

          try {
            await fetchOptionsInner();
            if (errorVWC.get() !== null) {
              errorVWC.set(null);
              errorVWC.callbacks.call(undefined);
            }
          } catch (e) {
            const err = await describeError(e);
            if (active) {
              errorVWC.set(err);
              errorVWC.callbacks.call(undefined);
            }
          }
        }
      }

      function handlePropsChanged() {
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }

        cleanup = handleProps();
      }
    }, [errorVWC, loginContext, optionsVWC, stateVWC, selectedVWC]);

    const onSelect = useCallback(
      async (word: Emotion, skipsStats?: boolean, replacedEmotionUserUid?: string | null) => {
        const options = optionsVWC.get();
        const selected = selectedVWC.get();
        if (
          options === null ||
          !options.words.some((w) => w === word) ||
          loginContext.state !== 'logged-in'
        ) {
          return;
        }

        if (replacedEmotionUserUid === undefined) {
          if (selected === null) {
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

          selectedVWC.set({
            word,
            emotionUserUid,
            journey,
            numVotes,
            numTotalVotes,
            profilePictures: voterPictures,
            skipsStats: skipsStats ?? false,
          });
          selectedVWC.callbacks.call(undefined);
        } catch (e) {
          const err = await describeError(e);
          errorVWC.set(err);
          errorVWC.callbacks.call(undefined);
        }
      },
      [loginContext, errorVWC, optionsVWC, selectedVWC]
    );

    useEffect(() => {
      let cleanup: (() => void) | null = null;
      selectedVWC.callbacks.add(handleSelectedChanged);
      handleSelectedChanged();
      return () => {
        selectedVWC.callbacks.remove(handleSelectedChanged);
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
      };

      function handleSelected(selected: Selected | null): (() => void) | undefined {
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
          profilePicturesVWC.set([]);
          profilePicturesVWC.callbacks.call(undefined);
          for (let r of requests) {
            r.stateChanged.remove(handleStateChanged);
            r.release();
          }
        };

        function handleStateChanged() {
          profilePicturesVWC.set(requests.map((r) => r.state));
          profilePicturesVWC.callbacks.call(undefined);
        }
      }

      function handleSelectedChanged() {
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
        cleanup = handleSelected(selectedVWC.get()) ?? null;
      }
    }, [selectedVWC, images, profilePicturesVWC]);

    const onFinishedJourney = useCallback(() => {
      if (isOnboardingVWC.get()) {
        localStorage.removeItem('onboard');
        isOnboardingVWC.set(false);
        isOnboardingVWC.callbacks.call(undefined);
      }

      reloadEmotions.current.call(undefined);
    }, [isOnboardingVWC]);

    const takeAnotherClass = useCallback(async () => {
      const selected = selectedVWC.get();
      if (selected === null) {
        reloadEmotions.current.call(undefined);
        return;
      }

      forceSplashVWC.set(true);
      selectedVWC.set(null);
      forceSplashVWC.callbacks.call(undefined);
      selectedVWC.callbacks.call(undefined);
      await new Promise((resolve) => setTimeout(resolve, 500));
      onSelect(selected.word, true, null);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      forceSplashVWC.set(false);
      forceSplashVWC.callbacks.call(undefined);
    }, [selectedVWC, forceSplashVWC, onSelect, reloadEmotions]);

    const onSelectVWC = useReactManagedValueAsValueWithCallbacks(onSelect);
    const onFinishedJourneyVWC = useReactManagedValueAsValueWithCallbacks(onFinishedJourney);
    const takeAnotherClassVWC = useReactManagedValueAsValueWithCallbacks(takeAnotherClass);

    return useMappedValuesWithCallbacks(
      [
        errorVWC,
        optionsVWC,
        backgroundVWC,
        selectedVWC,
        profilePictureVWC,
        profilePicturesVWC,
        forceSplashVWC,
        journeySharedVWC,
        isOnboardingVWC,
        onSelectVWC,
        onFinishedJourneyVWC,
        takeAnotherClassVWC,
      ],
      (): PickEmotionJourneyResources => {
        const error = errorVWC.get();
        const options = optionsVWC.get();
        const background = backgroundVWC.get();
        const profilePicture = profilePictureVWC.get();
        const profilePictures = profilePicturesVWC.get();
        const forceSplash = forceSplashVWC.get();
        const journeyShared = journeySharedVWC.get();
        const isOnboarding = isOnboardingVWC.get();
        const selected = selectedVWC.get();
        const onSelect = onSelectVWC.get();
        const onFinishedJourney = onFinishedJourneyVWC.get();
        const takeAnotherClass = takeAnotherClassVWC.get();

        return {
          loading: selected === null && error === null && (options === null || background.loading),
          error: error,
          profilePicture: profilePicture,
          options:
            error !== null || options === null
              ? null
              : {
                  clientUid: options.clientUid,
                  words: options.words,
                },
          selected:
            error !== null || selected === null
              ? null
              : {
                  word: selected.word,
                  emotionUserUid: selected.emotionUserUid,
                  journey: selected.journey,
                  shared: journeyShared,
                  numVotes: selected.numVotes,
                  numTotalVotes: selected.numTotalVotes,
                  profilePictures,
                  skipsStats: selected.skipsStats,
                },
          background,
          forceSplash,
          isOnboarding,
          onSelect,
          onFinishedJourney,
          takeAnotherClass,
          gotoFavorites: () => {
            allStates.get().favorites.setShow(true, true);
          },
        };
      }
    );
  },
  isRequired: () => true,
  component: (state, resources) => <PickEmotionJourney state={state} resources={resources} />,
};
