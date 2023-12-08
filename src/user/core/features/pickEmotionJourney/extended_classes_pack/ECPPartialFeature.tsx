import { ReactElement, useContext, useEffect } from 'react';
import { ECPResources } from './ECPResources';
import { ECPState } from './ECPState';
import { ExtendedClassesPack } from './ExtendedClassesPack';
import {
  InappNotification,
  useInappNotificationValueWithCallbacks,
} from '../../../../../shared/hooks/useInappNotification';
import { JourneyRef, journeyRefKeyMap } from '../../../../journey/models/JourneyRef';
import { LoginContext, LoginContextValueUnion } from '../../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../../../admin/crud/CrudFetcher';
import { useOsehImageStateRequestHandler } from '../../../../../shared/images/useOsehImageStateRequestHandler';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../../shared/hooks/useInappNotificationSession';
import { useJourneyShared } from '../../../../journey/hooks/useJourneyShared';
import { Emotion } from '../Emotion';
import { useOsehImageStateValueWithCallbacks } from '../../../../../shared/images/useOsehImageStateValueWithCallbacks';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * A feature-like object for the extended classes pack; this isn't a full
 * feature because it's not part of the FeatureAllStates as it's a sub-feature
 * for the pickEmotionJourney feature, but it operates very similarly.
 */
export const ECPPartialFeature = {
  useWorldState: (emotionVWC: ValueWithCallbacks<Emotion | null>): ValueWithCallbacks<ECPState> => {
    const loginContextRaw = useContext(LoginContext);
    const ianVWC = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_GqGxDHGQeZT9OsSEGEU90g', suppress: false },
    });
    const journeyVWC = useWritableValueWithCallbacks<JourneyRef | null | undefined>(
      () => undefined
    );

    useEffect(() => {
      let cleanup: (() => void) | null = null;
      emotionVWC.callbacks.add(handleChanged);
      ianVWC.callbacks.add(handleChanged);
      loginContextRaw.value.callbacks.add(handleChanged);
      handleChanged();
      return () => {
        emotionVWC.callbacks.remove(handleChanged);
        ianVWC.callbacks.remove(handleChanged);
        loginContextRaw.value.callbacks.remove(handleChanged);
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
      };

      function handle(
        emotion: Emotion | null,
        ian: InappNotification | null,
        loginContextUnch: LoginContextValueUnion
      ): (() => void) | undefined {
        if (
          loginContextUnch.state !== 'logged-in' ||
          ian === null ||
          !ian.showNow ||
          emotion === null
        ) {
          if (journeyVWC.get() !== undefined) {
            journeyVWC.set(undefined);
            journeyVWC.callbacks.call(undefined);
          }
          return;
        }
        const loginContext = loginContextUnch;

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
              if (journeyVWC.get() !== null) {
                journeyVWC.set(null);
                journeyVWC.callbacks.call(undefined);
              }
              return;
            }

            if (response.status === 204) {
              if (journeyVWC.get() !== null) {
                journeyVWC.set(null);
                journeyVWC.callbacks.call(undefined);
              }
              return;
            }

            const data = await response.json();
            if (!active) {
              return;
            }
            const newJourney = convertUsingKeymap(data, journeyRefKeyMap);
            journeyVWC.set(newJourney);
            journeyVWC.callbacks.call(undefined);
          } catch (e) {
            console.error('error fetching extended classes pack journey:', e);
            if (active) {
              if (journeyVWC.get() !== null) {
                journeyVWC.set(null);
                journeyVWC.callbacks.call(undefined);
              }
            }
          }
        }
      }

      function handleChanged() {
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }

        cleanup = handle(emotionVWC.get(), ianVWC.get(), loginContextRaw.value.get()) ?? null;
      }
    }, [ianVWC, loginContextRaw, emotionVWC, journeyVWC]);

    return useMappedValuesWithCallbacks(
      [ianVWC, emotionVWC, journeyVWC],
      (): ECPState => ({
        ian: ianVWC.get(),
        emotion: emotionVWC.get(),
        journey: journeyVWC.get(),
      })
    );
  },

  useResources: (
    stateVWC: ValueWithCallbacks<ECPState>,
    requiredVWC: ValueWithCallbacks<boolean>
  ): ValueWithCallbacks<ECPResources> => {
    const images = useOsehImageStateRequestHandler({});
    const sessionVWC = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: stateVWC.get().ian?.uid ?? null }),
      callbacks: stateVWC.callbacks,
    });
    const tallPreviewVWC = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => ({
          uid: requiredVWC.get() ? 'oseh_if_HbGIEpi23eBR0L1U3a-7Cg' : null,
          jwt: null,
          displayWidth: 305,
          displayHeight: 140,
          isPublic: true,
          alt: '5 new background images',
        }),
        callbacks: requiredVWC.callbacks,
      },
      images
    );
    const shortPreviewVWC = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => ({
          uid: requiredVWC.get() ? 'oseh_if_lsFgG35ppTGo-0KNm6lWlQ' : null,
          jwt: null,
          displayWidth: 291,
          displayHeight: 104,
          isPublic: true,
          alt: '5 new background images',
        }),
        callbacks: requiredVWC.callbacks,
      },
      images
    );
    const journeyShared = useJourneyShared({
      type: 'callbacks',
      props: () => stateVWC.get().journey ?? null,
      callbacks: stateVWC.callbacks,
    });

    return useMappedValuesWithCallbacks(
      [sessionVWC, tallPreviewVWC, shortPreviewVWC, journeyShared],
      (): ECPResources => ({
        session: sessionVWC.get(),
        tallPreview: tallPreviewVWC.get(),
        shortPreview: shortPreviewVWC.get(),
        journeyShared: journeyShared.get(),
        loading:
          sessionVWC.get() === null ||
          tallPreviewVWC.get().loading ||
          shortPreviewVWC.get().loading,
      })
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

  component: (
    state: ValueWithCallbacks<ECPState>,
    resources: ValueWithCallbacks<ECPResources>
  ): ReactElement => <ExtendedClassesPack state={state} resources={resources} />,
};
