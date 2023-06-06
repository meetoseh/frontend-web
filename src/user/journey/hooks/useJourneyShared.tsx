import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useOsehImageState } from '../../../shared/OsehImage';
import { JourneyRef } from '../models/JourneyRef';
import { JourneyShared } from '../models/JourneyShared';
import { useJourneyAudio } from './useJourneyAudio';
import { LoginContext } from '../../../shared/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';

/**
 * Creates the initial journey & journey start shared state
 */
export const useJourneyShared = (journey: JourneyRef | null): JourneyShared => {
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [shared, setShared] = useState<JourneyShared>({
    image: null,
    imageLoading: true,
    windowSize,
    blurredImage: null,
    blurredImageLoading: true,
    audio: null,
    favorited: null,
    setFavorited: () => {
      throw new Error('setFavorited called before favorited set');
    },
  });
  const imageProps = useMemo(
    () => ({
      uid: journey?.darkenedBackgroundImage?.uid ?? null,
      jwt: journey?.darkenedBackgroundImage?.jwt ?? null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
    }),
    [
      journey?.darkenedBackgroundImage?.uid,
      journey?.darkenedBackgroundImage?.jwt,
      windowSize.width,
      windowSize.height,
    ]
  );
  const image = useOsehImageState(imageProps);
  const blurredImageProps = useMemo(
    () => ({
      uid: journey?.blurredBackgroundImage?.uid ?? null,
      jwt: journey?.blurredBackgroundImage?.jwt ?? null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
    }),
    [
      journey?.blurredBackgroundImage?.uid,
      journey?.blurredBackgroundImage?.jwt,
      windowSize.width,
      windowSize.height,
    ]
  );
  const blurredImage = useOsehImageState(blurredImageProps);
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
      image,
      imageLoading: image.loading,
      blurredImage,
      blurredImageLoading: blurredImage.loading,
      windowSize,
      audio,
      favorited,
      setFavorited: setFavoritedWrapper,
    });
  }, [image, blurredImage, windowSize, audio, favorited, setFavoritedWrapper]);

  return shared;
};
