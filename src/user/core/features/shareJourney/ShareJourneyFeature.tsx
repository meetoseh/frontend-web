import { useCallback, useContext, useRef } from 'react';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { ShareJourneyResources } from './ShareJourneyResources';
import { ShareJourneyState } from './ShareJourneyState';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useTimedValueWithCallbacks } from '../../../../shared/hooks/useTimedValue';
import { HTTP_API_URL } from '../../../../shared/ApiConstants';
import { ShareJourney } from './ShareJourney';

export const ShareJourneyFeature: Feature<ShareJourneyState, ShareJourneyResources> = {
  identifier: 'shareJourney',
  useWorldState: () => {
    const loadingVWC = useWritableValueWithCallbacks<boolean>(() => false);
    const setLoading = useCallback((loading: boolean) => setVWC(loadingVWC, loading), [loadingVWC]);

    return useMappedValueWithCallbacks(loadingVWC, (loading) => ({
      loading,
      setLoading,
    }));
  },
  isRequired: (worldState, allStates) => {
    if (!worldState.loading) {
      return false;
    }

    return undefined;
  },
  useResources: (worldStateVWC, isRequiredVWC, allStatesVWC) => {
    const loginContextRaw = useContext(LoginContext);
    const ignoringLinkAnalytics = useTimedValueWithCallbacks(false, true, 1000);
    const startedRedirect = useRef(false);

    useMappedValuesWithCallbacks(
      [worldStateVWC, isRequiredVWC, allStatesVWC, loginContextRaw.value, ignoringLinkAnalytics],
      () => {
        if (startedRedirect.current) {
          return undefined;
        }

        const req = isRequiredVWC.get();
        if (!req) {
          return undefined;
        }

        const allStates = allStatesVWC.get();
        const state = worldStateVWC.get();
        const linkRaw = allStates.touchLink.linkInfo;

        if (linkRaw === undefined) {
          return undefined;
        }

        if (linkRaw === null || linkRaw.pageIdentifier !== 'share_journey') {
          state.setLoading(false);
          return undefined;
        }
        const link = linkRaw;
        const linkCodeRaw = allStates.touchLink.code;
        const journeyUid = link.pageExtra.journey_uid;

        if (typeof journeyUid !== 'string') {
          console.error('ignoring share touch link with missing/invalid journey uid');
          state.setLoading(false);
          allStates.touchLink.handledLink();
          return undefined;
        }

        if (!ignoringLinkAnalytics.get()) {
          const loginContextUnch = loginContextRaw.value.get();
          if (loginContextUnch.state === 'loading') {
            return undefined;
          }

          if (loginContextUnch.state === 'logged-in' && !allStates.touchLink.linkAnalyticsDone) {
            // wait for the user to be set
            return undefined;
          }
        }

        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/l/') && !currentPath.startsWith('/a/')) {
          state.setLoading(false);
          return undefined;
        }

        let running = true;
        fetchCanonicalUrlAndRedirect();
        return () => {
          running = false;
        };

        async function fetchCanonicalUrlAndRedirectInner() {
          const response = await fetch(
            `${HTTP_API_URL}/api/1/journeys/canonical_url/${journeyUid}`,
            { method: 'GET' }
          );
          if (!response.ok) {
            throw response;
          }
          const data: { uid: string; url: string } = await response.json();
          let url = data.url;
          startedRedirect.current = true;
          try {
            url = url + (linkCodeRaw !== null ? '?code=' + encodeURIComponent(linkCodeRaw) : '');
            allStates.touchLink.handledLink();
          } finally {
            window.location.assign(url);
          }
        }

        async function fetchCanonicalUrlAndRedirect() {
          try {
            await fetchCanonicalUrlAndRedirectInner();
          } catch (e) {
            if (running) {
              console.error('Failed to fetch canonical URL for journey to redirect to:', e);
              state.setLoading(false);
              allStates.touchLink.handledLink();
            }
          }
        }
      }
    );

    return useWritableValueWithCallbacks(() => ({ loading: true }));
  },
  component: (state, resources) => <ShareJourney state={state} resources={resources} />,
};
