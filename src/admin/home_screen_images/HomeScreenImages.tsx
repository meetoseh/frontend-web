import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { Crud } from '../crud/Crud';
import { CrudListing } from '../crud/CrudListing';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { HomeScreenImage, homeScreenImageKeyMap } from './HomeScreenImage';
import {
  HomeScreenImageFilterAndSortBlock,
  defaultFilter,
  defaultSort,
} from './HomeScreenImageFilterAndSortBlock';
import { HomeScreenImageBlock } from './HomeScreenImageBlock';
import { CreateHomeScreenImage } from './CreateHomeScreenImage';

const limit = 8;
const path = '/api/1/personalization/home/images/search';

/**
 * Shows the crud components for courses
 */
export const HomeScreenImages = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const itemsVWC = useWritableValueWithCallbacks<HomeScreenImage[]>(() => []);
  const filtersVWC = useWritableValueWithCallbacks<CrudFetcherFilter>(() => defaultFilter);
  const sortVWC = useWritableValueWithCallbacks<CrudFetcherSort>(() => defaultSort);
  const loadingVWC = useWritableValueWithCallbacks<boolean>(() => true);
  const haveMoreVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const imageHandler = useOsehImageStateRequestHandler({});

  const fetcher = useMemo(
    () =>
      new CrudFetcher(
        path,
        homeScreenImageKeyMap,
        adaptValueWithCallbacksAsSetState(itemsVWC),
        adaptValueWithCallbacksAsSetState(loadingVWC),
        adaptValueWithCallbacksAsSetState(haveMoreVWC)
      ),
    [itemsVWC, loadingVWC, haveMoreVWC]
  );

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, filtersVWC, sortVWC],
    useCallback(() => {
      const loginContext = loginContextRaw.value.get();
      if (loginContext.state !== 'logged-in') {
        return;
      }
      return fetcher.resetAndLoadWithCancelCallback(
        filtersVWC.get(),
        sortVWC.get(),
        limit,
        loginContext,
        console.error
      );
    }, [fetcher, loginContextRaw.value, filtersVWC, sortVWC])
  );

  const onMore = useCallback(() => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;
    fetcher.loadMore(filtersVWC.get(), limit, loginContext);
  }, [fetcher, filtersVWC, loginContextRaw]);

  const onItemCreated = useCallback(
    (item: HomeScreenImage) => {
      const existing = itemsVWC.get();
      const existingIndex = existing.findIndex((i) => i.uid === item.uid);
      if (existingIndex !== -1) {
        const newItems = [...existing];
        newItems[existingIndex] = item;
        setVWC(itemsVWC, newItems, () => false);
        return;
      } else {
        setVWC(itemsVWC, [...existing, item], () => false);
      }
    },
    [itemsVWC]
  );

  const listingInfoVWC = useMappedValuesWithCallbacks(
    [itemsVWC, loadingVWC, haveMoreVWC],
    useCallback(
      () => ({
        items: itemsVWC.get(),
        loading: loadingVWC.get(),
        haveMore: haveMoreVWC.get(),
      }),
      [itemsVWC, loadingVWC, haveMoreVWC]
    )
  );

  return (
    <Crud
      title="Home Screen Images"
      listing={
        <RenderGuardedComponent
          props={listingInfoVWC}
          component={({ items, loading, haveMore }) => (
            <CrudListing
              items={items}
              component={(i) => (
                <HomeScreenImageBlock
                  key={i.uid}
                  homeScreenImage={i}
                  setHomeScreenImage={(i) => {
                    const items = itemsVWC.get();
                    const index = items.findIndex((item) => item.uid === i.uid);
                    if (index === -1) {
                      return;
                    }
                    const newItems = [...items];
                    newItems[index] = i;
                    setVWC(itemsVWC, newItems, () => false);
                  }}
                  imageHandler={imageHandler}
                />
              )}
              loading={loading}
              haveMore={haveMore}
              onMore={onMore}
              smallItems
            />
          )}
        />
      }
      create={<CreateHomeScreenImage onCreated={onItemCreated} />}
      filters={<HomeScreenImageFilterAndSortBlock sort={sortVWC} filter={filtersVWC} />}
    />
  );
};
