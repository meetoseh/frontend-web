import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { Crud } from '../crud/Crud';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { CrudListing } from '../crud/CrudListing';
import {
  ClientFlowFilterAndSortBlock,
  defaultFilter,
  defaultSort,
} from './ClientFlowFilterAndSortBlock';
import { ClientFlow, clientFlowKeyMap } from './ClientFlow';
import { ClientFlowBlock } from './ClientFlowBlock';
import { CreateClientFlow } from './CreateClientFlow';

const limit = 8;
const path = '/api/1/client_flows/search';

/**
 * Allows viewing and mutating the available client flows
 */
export const ClientFlows = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const itemsVWC = useWritableValueWithCallbacks<ClientFlow[]>(() => []);
  const filtersVWC = useWritableValueWithCallbacks<CrudFetcherFilter>(() => defaultFilter);
  const sortVWC = useWritableValueWithCallbacks<CrudFetcherSort>(() => defaultSort);
  const loadingVWC = useWritableValueWithCallbacks<boolean>(() => true);
  const haveMoreVWC = useWritableValueWithCallbacks<boolean>(() => false);

  const fetcher = useMemo(
    () =>
      new CrudFetcher(
        path,
        clientFlowKeyMap,
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

  const onItemCreated = useCallback(
    (item: ClientFlow) => {
      const existing = itemsVWC.get();
      setVWC(itemsVWC, [...existing, item], () => false);
    },
    [itemsVWC]
  );

  return (
    <Crud
      title="Client Flows"
      listing={
        <RenderGuardedComponent
          props={listingInfoVWC}
          component={({ items, loading, haveMore }) => (
            <CrudListing
              items={items}
              component={(i) => (
                <ClientFlowBlock
                  key={i.uid}
                  clientFlow={i}
                  setClientFlow={(i) => {
                    const items = itemsVWC.get();
                    const index = items.findIndex((item) => item.uid === i.uid);
                    if (index === -1) {
                      return;
                    }
                    const newItems = [...items];
                    newItems[index] = i;
                    setVWC(itemsVWC, newItems, () => false);
                  }}
                />
              )}
              loading={loading}
              haveMore={haveMore}
              onMore={onMore}
            />
          )}
        />
      }
      create={<CreateClientFlow onCreated={onItemCreated} />}
      filters={<ClientFlowFilterAndSortBlock sort={sortVWC} filter={filtersVWC} />}
    />
  );
};
