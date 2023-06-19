import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { JourneyRef } from '../models/JourneyRef';
import { JourneyShared } from '../models/JourneyShared';
import { useJourneyAudio } from './useJourneyAudio';
import { LoginContext } from '../../../shared/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../shared/images/useOsehImageState';

/**
 * Creates the initial journey & journey start shared state
 */
export const useJourneyShared = (journey: JourneyRef | null): JourneyShared => {
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const imageHandler = useOsehImageStateRequestHandler({});
  const previewSize: { width: number; height: number } = useMemo(() => {
    if (windowSize.width >= 390 && windowSize.height >= 844) {
      return { width: 270, height: 470 };
    }

    return { width: 208, height: 357 };
  }, [windowSize]);
  const originalImage = useOsehImageState(
    {
      uid: journey?.backgroundImage?.uid ?? null,
      jwt: journey?.backgroundImage?.jwt ?? null,
      displayWidth: previewSize.width,
      displayHeight: previewSize.height,
      alt: '',
    },
    imageHandler
  );
  const darkenedImage = useOsehImageState(
    {
      uid: journey?.darkenedBackgroundImage?.uid ?? null,
      jwt: journey?.darkenedBackgroundImage?.jwt ?? null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
    },
    imageHandler
  );
  const blurredImage = useOsehImageState(
    {
      uid: journey?.blurredBackgroundImage?.uid ?? null,
      jwt: journey?.blurredBackgroundImage?.jwt ?? null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
    },
    imageHandler
  );
  const [shared, setShared] = useState<JourneyShared>(() => ({
    originalImage,
    darkenedImage,
    windowSize,
    blurredImage,
    audio: null,
    favorited: null,
    setFavorited: () => {
      throw new Error('setFavorited called before favorited set');
    },
  }));
  const audio = useJourneyAudio(journey?.audioContent ?? null);
  const [favorited, setFavorited] = useState<boolean | null>(null);

  const setFavoritedWrapper = useCallback(
    (val: boolean) => {
      if (favorited === null) {
        throw new Error('setFavorited called before favorited set');
      }

      setFavorited(val);
    },
    [favorited]
  );

  useEffect(() => {
    let active = true;
    loadFavorited();
    return () => {
      active = false;
    };

    async function loadFavoritedInner() {
      if (!active) {
        return;
      }
      if (loginContext.state === 'loading') {
        setFavorited(null);
        return;
      }

      if (loginContext.state === 'logged-out') {
        setFavorited(false);
        return;
      }

      if (journey === null) {
        setFavorited(null);
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
        loginContext
      );
      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      if (active) {
        setFavorited(data.items.length >= 1);
      }
    }

    async function loadFavorited() {
      try {
        await loadFavoritedInner();
      } catch (e) {
        console.error('error loading favorited, assuming not favorited', e);
        setFavorited(false);
      }
    }
  }, [loginContext, journey]);

  useEffect(() => {
    setShared({
      originalImage,
      darkenedImage,
      blurredImage,
      windowSize,
      audio,
      favorited,
      setFavorited: setFavoritedWrapper,
    });
  }, [
    originalImage,
    darkenedImage,
    blurredImage,
    windowSize,
    audio,
    favorited,
    setFavoritedWrapper,
  ]);

  return shared;
};
