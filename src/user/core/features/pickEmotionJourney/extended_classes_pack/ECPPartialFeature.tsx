import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
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
import { useOsehImageState } from '../../../../../shared/images/useOsehImageState';
import { useJourneyShared } from '../../../../journey/hooks/useJourneyShared';
import { Emotion } from '../Emotion';

/**
 * A feature-like object for the extended classes pack; this isn't a full
 * feature because it's not part of the FeatureAllStates as it's a sub-feature
 * for the pickEmotionJourney feature, but it operates very similarly.
 */
export const ECPPartialFeature = {
  useWorldState: (emotion: Emotion | null): ECPState => {
    const loginContext = useContext(LoginContext);
    const ian = useInappNotification('oseh_ian_GqGxDHGQeZT9OsSEGEU90g', false);
    const [journey, setJourney] = useState<JourneyRef | null | undefined>(undefined);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || ian === null || !ian.showNow || emotion === null) {
        setJourney(undefined);
        return;
      }

      let active = true;
      fetchJourney();
      return () => {
        active = false;
      };

      async function fetchJourney() {
        setJourney(undefined);

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
            setJourney(null);
            return;
          }

          if (response.status === 204) {
            setJourney(null);
            return;
          }

          const data = await response.json();
          if (!active) {
            return;
          }
          const journey = convertUsingKeymap(data, journeyRefKeyMap);
          setJourney(journey);
        } catch (e) {
          console.error('error fetching extended classes pack journey:', e);
          if (active) {
            setJourney(null);
          }
        }
      }
    }, [ian, loginContext, emotion]);

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

    const tallPreview = useOsehImageState(
      {
        uid: 'oseh_if_HbGIEpi23eBR0L1U3a-7Cg',
        jwt: null,
        displayWidth: 305,
        displayHeight: 140,
        isPublic: true,
        alt: '5 new background images',
      },
      images
    );
    const shortPreview = useOsehImageState(
      {
        uid: 'oseh_if_lsFgG35ppTGo-0KNm6lWlQ',
        jwt: null,
        displayWidth: 291,
        displayHeight: 104,
        isPublic: true,
        alt: '5 new background images',
      },
      images
    );
    const journeyShared = useJourneyShared(state.journey ?? null);

    return useMemo(
      () => ({
        session,
        tallPreview,
        shortPreview,
        journeyShared,
        loading:
          session === null ||
          tallPreview.loading ||
          shortPreview.loading ||
          journeyShared.darkenedImage.loading,
      }),
      [session, tallPreview, shortPreview, journeyShared]
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
