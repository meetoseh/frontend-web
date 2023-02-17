import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    setShared({
      image,
      imageLoading: image.loading,
      blurredImage,
      blurredImageLoading: blurredImage.loading,
      windowSize,
      audio,
    });
  }, [image, blurredImage, windowSize, audio]);

  return shared;
};
