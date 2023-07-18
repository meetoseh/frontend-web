import { useCallback } from 'react';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Feature } from '../../models/Feature';
import { FavoritesResources } from './FavoritesResources';
import { FavoritesState } from './FavoritesState';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { Favorites } from './Favorites';

const backgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const FavoritesFeature: Feature<FavoritesState, FavoritesResources> = {
  identifier: 'favorites',
  useWorldState: () => {
    const showVWC = useWritableValueWithCallbacks<boolean>(() => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      return path === '/favorites';
    });
    const tabVWC = useWritableValueWithCallbacks<'favorites' | 'history' | 'courses'>(() => {
      if (!showVWC.get()) {
        return 'favorites';
      }
      const url = new URL(window.location.href);
      const tab = url.searchParams.get('tab');
      if (tab === 'favorites' || tab === 'history' || tab === 'courses') {
        return tab;
      }
      return 'favorites';
    });

    const setShow = useCallback(
      (wantsFavorites: boolean, updateWindowHistory: boolean) => {
        if (wantsFavorites === showVWC.get()) {
          return;
        }

        if (wantsFavorites) {
          setVWC(showVWC, true);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/favorites?tab=${encodeURIComponent(tabVWC.get())}`);
          }
        } else {
          setVWC(showVWC, false);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/`);
          }
        }
      },
      [showVWC, tabVWC]
    );

    const setTab = useCallback(
      (tab: 'favorites' | 'history' | 'courses', updateWindowHistory: boolean) => {
        if (tab === tabVWC.get()) {
          return;
        }

        setVWC(tabVWC, tab);
        if (showVWC.get() && updateWindowHistory) {
          window.history.pushState({}, '', `/favorites?tab=${encodeURIComponent(tab)}`);
        }
      },
      [showVWC, tabVWC]
    );

    return useMappedValuesWithCallbacks(
      [showVWC, tabVWC],
      (): FavoritesState => ({
        show: showVWC.get(),
        tab: tabVWC.get(),
        setTab,
        setShow,
      })
    );
  },
  useResources: (stateVWC, requiredVWC) => {
    const windowSizeVWC = useWindowSizeValueWithCallbacks();
    const imageHandler = useOsehImageStateRequestHandler({});
    const backgroundProps = useMappedValuesWithCallbacks(
      [requiredVWC, windowSizeVWC],
      (): OsehImageProps => ({
        uid: requiredVWC.get() ? backgroundUid : null,
        jwt: null,
        displayWidth: windowSizeVWC.get().width,
        displayHeight: windowSizeVWC.get().height,
        alt: '',
        isPublic: true,
      })
    );
    const backgroundVWC = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => backgroundProps.get(),
        callbacks: backgroundProps.callbacks,
      },
      imageHandler
    );
    return useMappedValuesWithCallbacks(
      [backgroundVWC],
      (): FavoritesResources => ({
        background: backgroundVWC.get(),
        loading: backgroundVWC.get().loading,
      })
    );
  },
  isRequired: (state) => state.show,
  component: (state, resources) => <Favorites state={state} resources={resources} />,
};
