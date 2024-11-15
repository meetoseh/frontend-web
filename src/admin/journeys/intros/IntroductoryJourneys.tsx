import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { Crud } from '../../crud/Crud';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../../crud/CrudFetcher';
import { CrudListing } from '../../crud/CrudListing';
import { CreateIntroductoryJourney } from './CreateIntroductoryJourney';
import { IntroductoryJourney, keyMap } from './IntroductoryJourney';
import { IntroductoryJourneyBlock } from './IntroductoryJourneyBlock';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';

const path = '/api/1/journeys/introductory/search';
const limit = 8;
const defaultFilter: CrudFetcherFilter = {};
const defaultSort: CrudFetcherSort = [];

/**
 * Shows the crud components for introductory journeys, i.e, journeys that a
 * user would see during their onboarding flow. These are generally fairly
 * generic journeys to ensure the user gets a good first experience before
 * getting thrown into the current daily event.
 */
export const IntroductoryJourneys = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [journeys, setJourneys] = useState<IntroductoryJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);
  const filters = defaultFilter;
  const sort = defaultSort;
  const imageHandler = useOsehImageStateRequestHandler({});

  const createComponent = useMemo(() => {
    return (
      <CreateIntroductoryJourney
        onCreated={(newJourney) => {
          setJourneys((oldJourneys) => [...oldJourneys, newJourney]);
        }}
        imageHandler={imageHandler}
      />
    );
  }, [imageHandler]);

  const component = useCallback(
    (journey: IntroductoryJourney) => {
      return (
        <IntroductoryJourneyBlock
          journey={journey}
          onChanged={(newJourney) => {
            setJourneys((oldJourneys) => {
              return oldJourneys.map((j) => (j.uid === journey.uid ? newJourney : j));
            });
          }}
          onDeleted={() => {
            setJourneys((oldJourneys) => {
              return oldJourneys.filter((j) => j.uid !== journey.uid);
            });
          }}
          imageHandler={imageHandler}
        />
      );
    },
    [imageHandler]
  );

  const fetcher = useMemo(
    () => new CrudFetcher(path, keyMap, setJourneys, setLoading, setHaveMore),
    []
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContext) => {
        if (loginContext.state !== 'logged-in') {
          return;
        }
        return fetcher.resetAndLoadWithCancelCallback(
          filters,
          sort,
          limit,
          loginContext,
          console.error
        );
      },
      [fetcher, filters, sort]
    )
  );

  const onMore = useCallback(() => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;
    fetcher.loadMore(filters, limit, loginContext);
  }, [fetcher, filters, loginContextRaw.value]);

  return (
    <Crud
      title="Introductory Journeys"
      listing={
        <CrudListing
          items={journeys}
          component={component}
          loading={loading}
          haveMore={haveMore}
          onMore={onMore}
        />
      }
      create={createComponent}
      filters={<></>}
    />
  );
};
