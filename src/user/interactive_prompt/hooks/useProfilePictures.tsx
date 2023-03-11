import { MutableRefObject, useContext, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { LoginContext } from '../../../shared/LoginContext';
import {
  OsehImageProps,
  OsehImageRef,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
  waitUntilNextImageStateUpdateCancelable,
} from '../../../shared/OsehImage';
import { InteractivePrompt } from '../models/InteractivePrompt';
import {
  PromptTime,
  waitUntilUsingPromptTime,
  waitUntilUsingPromptTimeCancelable,
} from './usePromptTime';
import { PromptStats, StatsChangedEvent, waitUntilNextStatsUpdateCancelable } from './useStats';

/**
 * The actual state which is maintained by useProfilePictures - though this
 * does not by default trigger state updates.
 */
export type ProfilePicturesState = {
  /**
   * The profile pictures to display. All are fully loaded before they
   * are added to this array.
   */
  pictures: OsehImageState[];

  /**
   * The number of additional users that are not shown in the profile
   * pictures. This is 0 if all users are shown.
   */
  additionalUsers: number;
};

export type ProfilePicturesStateChangedEvent = {
  /**
   * The previous state
   */
  old: ProfilePicturesState;

  /**
   * The current state
   */
  current: ProfilePicturesState;
};

/**
 * The actual result of the useProfilePictures hook - contains refs
 * to the state, as well as a ref to callbacks to call when the state
 * changes.
 */
export type ProfilePicturesStateRef = {
  /**
   * The current value of the state
   */
  state: MutableRefObject<ProfilePicturesState>;

  /**
   * The callbacks to call when the state changes
   */
  onStateChanged: MutableRefObject<Callbacks<ProfilePicturesStateChangedEvent>>;
};

type ProfilePicturesProps = {
  /**
   * The interactive prompt to generate profile pictures for
   */
  prompt: InteractivePrompt;

  /**
   * The prompt time to use to generate the profile pictures
   */
  promptTime: PromptTime;

  /**
   * The prompt statistics, used for determining the number of users
   */
  stats: PromptStats;
};

const displayWidth = 38;
const displayHeight = 38;

/**
 * A hook-like function which generates a set of profile pictures
 * to display, where the profile pictures represent a sample of
 * people active in the prompt at the current prompt time.
 */
export const useProfilePictures = ({
  prompt,
  promptTime,
  stats,
}: ProfilePicturesProps): ProfilePicturesStateRef => {
  const stateRef = useRef<ProfilePicturesState>() as MutableRefObject<ProfilePicturesState>;
  const onStateChangedRef = useRef<
    Callbacks<ProfilePicturesStateChangedEvent>
  >() as MutableRefObject<Callbacks<ProfilePicturesStateChangedEvent>>;
  const loginContext = useContext(LoginContext);
  const imagesRef = useOsehImageStatesRef({ cacheSize: 128 });

  if (stateRef.current === undefined) {
    stateRef.current = { pictures: [], additionalUsers: 0 };
  }

  if (onStateChangedRef.current === undefined) {
    onStateChangedRef.current = new Callbacks();
  }

  useEffect(() => {
    let active = true;
    const cancelers = new Callbacks<undefined>();
    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;
      cancelers.call(undefined);
    };

    const imageRefsByPromptTime = new Map<number, OsehImageRef[]>();

    getImageRefs();
    handlePictures();
    return unmount;

    async function getImageRefs() {
      const lastBin = (() => {
        const res = Math.floor(prompt.durationSeconds / 2);
        if (res * 2 === prompt.durationSeconds) {
          return res - 1;
        }
        return res;
      })();
      let currentBin = Math.max(0, Math.floor(promptTime.time.current / 2000));
      let nextBinToLoad = currentBin;

      while (active && nextBinToLoad <= lastBin) {
        currentBin = Math.max(0, Math.floor(promptTime.time.current / 2000));

        if (nextBinToLoad > currentBin + 1) {
          // eslint-disable-next-line no-loop-func
          await waitUntilUsingPromptTime(promptTime, (event) => {
            const newCurrentBin = Math.floor(event.current / 2000);
            return nextBinToLoad <= newCurrentBin + 1;
          });
          currentBin = Math.max(0, Math.floor(promptTime.time.current / 2000));
        }

        const bin = nextBinToLoad;
        try {
          const response = await apiFetch(
            '/api/1/interactive_prompts/profile_pictures',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                uid: prompt.uid,
                jwt: prompt.jwt,
                prompt_time: bin * 2,
                limit: 5,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data: { items: { picture: OsehImageRef }[] } = await response.json();
          const imageRefs = data.items.map((item) => item.picture);
          imageRefsByPromptTime.set(bin, imageRefs);
        } catch (e) {
          console.error(
            'failed to fetch profile pictures for prompt ',
            prompt.uid,
            ' at time ',
            bin * 2,
            ': ',
            e
          );
          imageRefsByPromptTime.set(bin, []);
        }

        imageRefsByPromptTime.delete(currentBin - 1);
        nextBinToLoad += 1;
      }
    }

    async function handlePictures() {
      let timePromise: CancelablePromise<void> | null = null;
      let imageLoadedPromise: CancelablePromise<OsehImageStateChangedEvent> | null = null;
      let statsChangedPromise: CancelablePromise<StatsChangedEvent> | null = null;
      const canceledPromise = new Promise<void>((resolve) => {
        cancelers.add(() => resolve());
      });

      while (active) {
        const currentBin = Math.max(0, Math.floor(promptTime.time.current / 2000));
        const imageRefs = imageRefsByPromptTime.get(currentBin);
        if (imageRefs === undefined) {
          await Promise.race([
            waitUntilUsingPromptTime(promptTime, (event) => {
              const newCurrentBin = Math.floor(event.current / 2000);
              return imageRefsByPromptTime.has(newCurrentBin);
            }),
            canceledPromise,
          ]);
          continue;
        }

        const nextImageRefs = imageRefsByPromptTime.get(currentBin + 1);
        ensureLoading(imageRefs.concat(nextImageRefs || []));

        const loadedImages: OsehImageState[] = [];
        for (const imgRef of imageRefs) {
          const state = imagesRef.state.current.get(imgRef.uid);
          if (state && !state.loading) {
            loadedImages.push(state);
          }
        }

        const additionalUsers = stats.stats.current.users - loadedImages.length;
        const oldState = stateRef.current;
        stateRef.current = {
          pictures: loadedImages,
          additionalUsers,
        };
        onStateChangedRef.current.call({
          old: oldState,
          current: stateRef.current,
        });

        if (timePromise === null || timePromise.done()) {
          timePromise = waitUntilUsingPromptTimeCancelable(promptTime, (event) => {
            return event.current >= (currentBin + 1) * 2000;
          });
        }

        if (imageLoadedPromise === null || imageLoadedPromise.done()) {
          imageLoadedPromise = waitUntilNextImageStateUpdateCancelable(imagesRef);
        }

        if (statsChangedPromise === null || statsChangedPromise.done()) {
          statsChangedPromise = waitUntilNextStatsUpdateCancelable(stats);
        }

        await Promise.race([
          timePromise.promise,
          imageLoadedPromise.promise,
          statsChangedPromise.promise,
          canceledPromise,
        ]);
      }

      timePromise?.cancel();
      imageLoadedPromise?.cancel();
      statsChangedPromise?.cancel();
      unmount();
    }

    function ensureLoading(imageRefs: OsehImageRef[]) {
      const uidSet = new Set(imageRefs.map((ref) => ref.uid));
      const toRemoveUids: string[] = [];
      imagesRef.handling.current.forEach((_, uid) => {
        if (!uidSet.has(uid)) {
          toRemoveUids.push(uid);
        }
      });
      for (const toRemoveUid of toRemoveUids) {
        const old = imagesRef.handling.current.get(toRemoveUid);
        if (old) {
          imagesRef.handling.current.delete(toRemoveUid);
          imagesRef.onHandlingChanged.current.call({
            uid: toRemoveUid,
            old,
            current: null,
          });
        }
      }

      for (const ref of imageRefs) {
        if (!imagesRef.handling.current.has(ref.uid)) {
          const imageProps: OsehImageProps = {
            uid: ref.uid,
            jwt: ref.jwt,
            displayWidth,
            displayHeight,
            alt: 'Profile',
          };

          imagesRef.handling.current.set(ref.uid, imageProps);
          imagesRef.onHandlingChanged.current.call({
            uid: ref.uid,
            old: null,
            current: imageProps,
          });
        }
      }
    }
  }, [prompt, promptTime, stats, loginContext, imagesRef]);

  return useMemo(
    () => ({
      state: stateRef,
      onStateChanged: onStateChangedRef,
    }),
    []
  );
};
