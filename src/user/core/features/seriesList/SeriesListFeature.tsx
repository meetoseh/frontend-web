import { useCallback } from 'react';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { SeriesListResources } from './SeriesListResources';
import { SeriesListForced, SeriesListState } from './SeriesListState';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { SeriesList } from './SeriesList';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';

export const SeriesListFeature: Feature<SeriesListState, SeriesListResources> = {
  identifier: 'seriesList',
  useWorldState() {
    const forcedVWC = useWritableValueWithCallbacks((): SeriesListForced | null => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      if (path === '/series') {
        return { enter: 'fade' };
      }
      return null;
    });

    const setForced = useCallback(
      (forced: SeriesListForced | null, updateWindowHistory: boolean) => {
        updateWindowHistory &&= (forced === null) !== (forcedVWC.get() === null);
        if (forced !== null) {
          setVWC(forcedVWC, forced);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/series`);
          }
        } else {
          setVWC(forcedVWC, null);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/`);
          }
        }
      },
      [forcedVWC]
    );

    return useMappedValuesWithCallbacks(
      [forcedVWC],
      useCallback(
        () => ({
          forced: forcedVWC.get(),
          setForced,
        }),
        [forcedVWC, setForced]
      )
    );
  },
  isRequired(state) {
    return state.forced !== null;
  },
  useResources(state, required, allStates) {
    const imageHandler = useOsehImageStateRequestHandler({});

    return useWritableValueWithCallbacks(() => ({
      loading: false,
      imageHandler,
      gotoSettings: () => {
        allStates.get().settings.setShow(true, true);
        state.get().setForced(null, false);
      },
      gotoCoursePreview: (course) => {
        allStates.get().seriesPreview.setShow({ course, enter: 'fade' }, true);
        state.get().setForced(null, false);
      },
      gotoCourseDetails: (course) => {
        allStates.get().seriesDetails.setShow(course, true);
        state.get().setForced(null, false);
      },
    }));
  },
  component: (state, resources) => <SeriesList state={state} resources={resources} />,
};
