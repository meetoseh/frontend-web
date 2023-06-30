import { ReactElement, useContext, useEffect, useMemo } from 'react';
import { ECPResources } from './ECPResources';
import { ECPState } from './ECPState';
import { ExtendedClassesPack } from './ExtendedClassesPack';
import { useInappNotification } from '../../../../../shared/hooks/useInappNotification';
import { JourneyRef, journeyRefKeyMap } from '../../../../journey/models/JourneyRef';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../../../admin/crud/CrudFetcher';
import { useOsehImageStateRequestHandler } from '../../../../../shared/images/useOsehImageStateRequestHandler';
import { useInappNotificationSession } from '../../../../../shared/hooks/useInappNotificationSession';
import { useJourneyShared } from '../../../../journey/hooks/useJourneyShared';
import { Emotion } from '../Emotion';
import { useOsehImageStateValueWithCallbacks } from '../../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useAnyImageStateValueWithCallbacksLoading } from '../../../../../shared/images/useAnyImageStateValueWithCallbacksLoading';
import { useWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * A feature-like object for the extended classes pack; this isn't a full
 * feature because it's not part of the FeatureAllStates as it's a sub-feature
 * for the pickEmotionJourney feature, but it operates very similarly.
 */
export const ECPPartialFeature = {
  useWorldState: (emotion: Emotion | null): ECPState => {
    const loginContext = useContext(LoginContext);
    const ian = useInappNotification('oseh_ian_GqGxDHGQeZT9OsSEGEU90g', false);
    const journey = useWritableValueWithCallbacks<JourneyRef | null | undefined>(() => undefined);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || ian === null || !ian.showNow || emotion === null) {
        if (journey.get() !== undefined) {
          journey.set(undefined);
          journey.callbacks.call(undefined);
        }
        return;
      }

      let active = true;
      fetchJourney();
      return () => {
        active = false;
      };

      async function fetchJourney() {
        try {
          const response = await apiFetch(
            '/api/1/campaigns/extended_classes_pack/consider',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({ emotion: emotion?.word ?? null }),
            },
            loginContext
          );
          if (!active) {
            return;
          }

          if (!response.ok) {
            if (journey.get() !== null) {
              journey.set(null);
              journey.callbacks.call(undefined);
            }
            return;
          }

          if (response.status === 204) {
            if (journey.get() !== null) {
              journey.set(null);
              journey.callbacks.call(undefined);
            }
            return;
          }

          const data = await response.json();
          if (!active) {
            return;
          }
          const newJourney = convertUsingKeymap(data, journeyRefKeyMap);
          journey.set(newJourney);
          journey.callbacks.call(undefined);
        } catch (e) {
          console.error('error fetching extended classes pack journey:', e);
          if (active) {
            if (journey.get() !== null) {
              journey.set(null);
              journey.callbacks.call(undefined);
            }
          }
        }
      }
    }, [ian, loginContext, emotion, journey]);

    return useMemo(
      () => ({
        ian,
        journey,
        emotion,
      }),
      [ian, journey, emotion]
    );
  },

  useResources: (state: ECPState, required: boolean): ECPResources => {
    const images = useOsehImageStateRequestHandler({});
    const session = useInappNotificationSession(state.ian?.showNow ? state.ian.uid : null);

    const tallPreview = useOsehImageStateValueWithCallbacks(
      {
        type: 'react-rerender',
        props: {
          uid: 'oseh_if_HbGIEpi23eBR0L1U3a-7Cg',
          jwt: null,
          displayWidth: 305,
          displayHeight: 140,
          isPublic: true,
          alt: '5 new background images',
        },
      },
      images
    );
    const shortPreview = useOsehImageStateValueWithCallbacks(
      {
        type: 'react-rerender',
        props: {
          uid: 'oseh_if_lsFgG35ppTGo-0KNm6lWlQ',
          jwt: null,
          displayWidth: 291,
          displayHeight: 104,
          isPublic: true,
          alt: '5 new background images',
        },
      },
      images
    );
    const journeyShared = useJourneyShared({
      type: 'callbacks',
      props: () => state.journey.get() ?? null,
      callbacks: state.journey.callbacks,
    });
    const imagesLoading = useAnyImageStateValueWithCallbacksLoading(
      [
        tallPreview,
        shortPreview,
        useMappedValueWithCallbacks(journeyShared, (s) => s.darkenedImage),
      ],
      true
    );

    return useMemo(
      () => ({
        session,
        tallPreview,
        shortPreview,
        journeyShared,
        loading: session === null || imagesLoading,
      }),
      [session, tallPreview, shortPreview, journeyShared, imagesLoading]
    );
  },

  isRequired: (state: ECPState): boolean | undefined => {
    if (state.ian === null) {
      return undefined;
    }

    if (!state.ian.showNow) {
      return false;
    }

    if (state.journey === undefined) {
      return undefined;
    }

    return state.journey !== null;
  },

  component: (state: ECPState, resources: ECPResources): ReactElement => (
    <ExtendedClassesPack state={state} resources={resources} />
  ),
};
