import { useContext, useEffect } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import {
  Callbacks,
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptTime } from './usePromptTime';
import { OsehImageState } from '../../../shared/images/OsehImageState';
import {
  OsehImageRequestedState,
  useOsehImageStateRequestHandler,
} from '../../../shared/images/useOsehImageStateRequestHandler';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import { Stats } from './useStats';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';

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

type ProfilePicturesProps = {
  /**
   * The interactive prompt to generate profile pictures for
   */
  prompt: VariableStrategyProps<InteractivePrompt>;

  /**
   * The prompt time to use to generate the profile pictures
   */
  promptTime: VariableStrategyProps<PromptTime>;

  /**
   * The prompt statistics, used for determining the number of users
   */
  stats: VariableStrategyProps<Stats>;
};

const displayWidth = 38;
const displayHeight = 38;

/**
 * A hook-like function which generates a set of profile pictures
 * to display, where the profile pictures represent a sample of
 * people active in the prompt at the current prompt time.
 */
export const useProfilePictures = ({
  prompt: promptVariableStrategy,
  promptTime: promptTimeVariableStrategy,
  stats: statsVariableStrategy,
}: ProfilePicturesProps): ValueWithCallbacks<ProfilePicturesState> => {
  const promptVWC = useVariableStrategyPropsAsValueWithCallbacks(promptVariableStrategy);
  const promptTimeVWC = useVariableStrategyPropsAsValueWithCallbacks(promptTimeVariableStrategy);
  const statsVWC = useVariableStrategyPropsAsValueWithCallbacks(statsVariableStrategy);

  const result = useWritableValueWithCallbacks(
    (): ProfilePicturesState => ({
      pictures: [],
      additionalUsers: 0,
    })
  );
  const loginContextRaw = useContext(LoginContext);
  const imagesHandler = useOsehImageStateRequestHandler({
    playlistCacheSize: 128,
    imageCacheSize: 128,
    cropCacheSize: 128,
  });

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
        const res = Math.floor(promptVWC.get().durationSeconds / 2);
        if (res * 2 === promptVWC.get().durationSeconds) {
          return res - 1;
        }
        return res;
      })();
      let currentBin = Math.max(0, Math.floor(promptTimeVWC.get().time / 2000));
      let nextBinToLoad = currentBin;

      while (active && nextBinToLoad <= lastBin) {
        currentBin = Math.max(0, Math.floor(promptTimeVWC.get().time / 2000));

        if (nextBinToLoad > currentBin + 1) {
          const timePromiseCancelable = waitForValueWithCallbacksConditionCancelable(
            promptTimeVWC,
            // eslint-disable-next-line no-loop-func
            (promptTime) => {
              const newCurrentBin = Math.floor(promptTime.time / 2000);
              return nextBinToLoad <= newCurrentBin + 1;
            }
          );
          const cancelPromise = createCancelablePromiseFromCallbacks(cancelers);
          await Promise.race([
            timePromiseCancelable.promise.catch(() => {}),
            cancelPromise.promise.catch(() => {}),
          ]);
          timePromiseCancelable.cancel();
          cancelPromise.cancel();
          continue;
        }

        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state !== 'logged-in') {
          const loggedInPromiseCancelable = waitForValueWithCallbacksConditionCancelable(
            loginContextRaw.value,
            (v) => v.state === 'logged-in'
          );
          const cancelPromise = createCancelablePromiseFromCallbacks(cancelers);
          await Promise.race([
            loggedInPromiseCancelable.promise.catch(() => {}),
            cancelPromise.promise.catch(() => {}),
          ]);
          loggedInPromiseCancelable.cancel();
          cancelPromise.cancel();
          continue;
        }
        const loginContext = loginContextUnch;

        const bin = nextBinToLoad;
        if (bin < currentBin - 1) {
          // skip over missed bins one at a time to keep the loop
          // logic simpler
          imageRequestsByPromptTime.set(bin, []);
        } else {
          try {
            const response = await apiFetch(
              '/api/1/interactive_prompts/profile_pictures',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                  uid: promptVWC.get().uid,
                  jwt: promptVWC.get().jwt,
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
              promptVWC.get().uid,
              ' at time ',
              bin * 2,
              ': ',
              e
            );
            imageRequestsByPromptTime.set(bin, []);
          }
        }

        const deletedBinNumber = bin - 2;
        const deletedBin = imageRequestsByPromptTime.get(bin - 2);
        if (deletedBin !== undefined) {
          imageRequestsByPromptTime.delete(deletedBinNumber);
          for (const req of deletedBin) {
            req.release();
          }
        }
        nextBinToLoad += 1;
      }
    }

    async function handlePictures() {
      let timePromise: CancelablePromise<PromptTime> | null = null;
      let statsChangedPromise: CancelablePromise<undefined> | null = null;
      let imageLoadedPromise: CancelablePromise<void> | null = null;
      const imageLoadedCallbacks = new Callbacks<undefined>();
      const canceledPromise = new Promise<void>((resolve) => {
        cancelers.add(() => resolve());
      });

      while (active) {
        const currentBin = Math.max(0, Math.floor(promptTimeVWC.get().time / 2000));
        const imageRequests = imageRequestsByPromptTime.get(currentBin);
        if (imageRequests === undefined) {
          const availableCancelablePromise = waitForValueWithCallbacksConditionCancelable(
            promptTimeVWC,
            (promptTime) => {
              const newCurrentBin = Math.floor(promptTime.time / 2000);
              return imageRequestsByPromptTime.has(newCurrentBin);
            }
          );
          await Promise.race([availableCancelablePromise.promise.catch(() => {}), canceledPromise]);
          availableCancelablePromise.cancel();
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

        const additionalUsers = statsVWC.get().users - loadedImages.length;
        result.set({
          pictures: loadedImages,
          additionalUsers,
        });
        result.callbacks.call(undefined);

        if (timePromise === null || timePromise.done()) {
          timePromise = waitForValueWithCallbacksConditionCancelable(
            promptTimeVWC,
            (promptTime) => {
              return promptTime.time >= (currentBin + 1) * 2000;
            }
          );
        }

        if (statsChangedPromise === null || statsChangedPromise.done()) {
          statsChangedPromise = createCancelablePromiseFromCallbacks(statsVWC.callbacks);
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
  }, [promptVWC, promptTimeVWC, statsVWC, loginContextRaw, imagesHandler, result]);

  return result;
};
