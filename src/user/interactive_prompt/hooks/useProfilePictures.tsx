import { MutableRefObject, useContext, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { InteractivePrompt } from '../models/InteractivePrompt';
import {
  PromptTime,
  waitUntilUsingPromptTime,
  waitUntilUsingPromptTimeCancelable,
} from './usePromptTime';
import { PromptStats, StatsChangedEvent, waitUntilNextStatsUpdateCancelable } from './useStats';
import { OsehImageState } from '../../../shared/images/OsehImageState';
import {
  OsehImageRequestedState,
  useOsehImageStateRequestHandler,
} from '../../../shared/images/useOsehImageStateRequestHandler';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';

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
  const imagesHandler = useOsehImageStateRequestHandler({
    playlistCacheSize: 128,
    imageCacheSize: 128,
    cropCacheSize: 128,
  });

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

    const imageRequestsByPromptTime = new Map<number, OsehImageRequestedState[]>();

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
          const imageRequests = imageRefs.map((ref) =>
            imagesHandler.request({
              uid: ref.uid,
              jwt: ref.jwt,
              displayWidth,
              displayHeight,
              alt: '',
            })
          );
          imageRequestsByPromptTime.set(bin, imageRequests);
        } catch (e) {
          console.error(
            'failed to fetch profile pictures for prompt ',
            prompt.uid,
            ' at time ',
            bin * 2,
            ': ',
            e
          );
          imageRequestsByPromptTime.set(bin, []);
        }

        const deletedBin = imageRequestsByPromptTime.get(currentBin - 1);
        if (deletedBin !== undefined) {
          imageRequestsByPromptTime.delete(currentBin - 1);
          for (const req of deletedBin) {
            req.release();
          }
        }
        nextBinToLoad += 1;
      }
    }

    async function handlePictures() {
      let timePromise: CancelablePromise<void> | null = null;
      let statsChangedPromise: CancelablePromise<StatsChangedEvent> | null = null;
      let imageLoadedPromise: CancelablePromise<void> | null = null;
      const imageLoadedCallbacks = new Callbacks<undefined>();
      const canceledPromise = new Promise<void>((resolve) => {
        cancelers.add(() => resolve());
      });

      while (active) {
        const currentBin = Math.max(0, Math.floor(promptTime.time.current / 2000));
        const imageRequests = imageRequestsByPromptTime.get(currentBin);
        if (imageRequests === undefined) {
          await Promise.race([
            waitUntilUsingPromptTime(promptTime, (event) => {
              const newCurrentBin = Math.floor(event.current / 2000);
              return imageRequestsByPromptTime.has(newCurrentBin);
            }),
            canceledPromise,
          ]);
          continue;
        }

        const loadedImages: OsehImageState[] = [];
        imageLoadedPromise = null;
        for (const imgReq of imageRequests) {
          const state = imgReq.state;
          if (!state.loading) {
            loadedImages.push(state);
          } else {
            if (imageLoadedPromise === null) {
              imageLoadedPromise = createCancelablePromiseFromCallbacks(imageLoadedCallbacks);
            }
            (() => {
              const handler = () => {
                imageLoadedCallbacks.call(undefined);
                imgReq.stateChanged.remove(handler);
              };
              imgReq.stateChanged.add(handler);
            })();
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

        if (statsChangedPromise === null || statsChangedPromise.done()) {
          statsChangedPromise = waitUntilNextStatsUpdateCancelable(stats);
        }

        await Promise.race([
          timePromise.promise,
          ...(imageLoadedPromise ? [imageLoadedPromise.promise] : []),
          statsChangedPromise.promise,
          canceledPromise,
        ]);
      }

      timePromise?.cancel();
      imageLoadedPromise?.cancel();
      statsChangedPromise?.cancel();
      unmount();
    }
  }, [prompt, promptTime, stats, loginContext, imagesHandler]);

  return useMemo(
    () => ({
      state: stateRef,
      onStateChanged: onStateChangedRef,
    }),
    []
  );
};
