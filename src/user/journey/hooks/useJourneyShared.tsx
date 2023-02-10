import { useEffect, useState } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useOsehImageState } from '../../../shared/OsehImage';
import { JourneyRef } from '../models/JourneyRef';
import { JourneyShared } from '../models/JourneyShared';
import { useJourneyAudio } from './useJourneyAudio';

/**
 * Creates the initial journey & journey start shared state
 */
export const useJourneyShared = (journey: JourneyRef | null): JourneyShared => {
  const windowSize = useWindowSize();
  const [shared, setShared] = useState<JourneyShared>({
    image: null,
    imageLoading: true,
    windowSize,
    blurredImage: null,
    blurredImageLoading: true,
    audio: null,
  });
  const [imageLoading, setImageLoading] = useState(true);
  const image = useOsehImageState({
    uid: journey?.darkenedBackgroundImage?.uid ?? null,
    jwt: journey?.darkenedBackgroundImage?.jwt ?? null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    setLoading: setImageLoading,
  });
  const [blurredImageLoading, setBlurredImageLoading] = useState(true);
  const blurredImage = useOsehImageState({
    uid: journey?.blurredBackgroundImage?.uid ?? null,
    jwt: journey?.blurredBackgroundImage?.jwt ?? null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    setLoading: setBlurredImageLoading,
  });
  const audio = useJourneyAudio(journey?.audioContent ?? null);

  useEffect(() => {
    setShared({
      image,
      imageLoading,
      blurredImage,
      blurredImageLoading,
      windowSize,
      audio,
    });
  }, [image, imageLoading, blurredImage, blurredImageLoading, windowSize, audio]);

  return shared;
};
