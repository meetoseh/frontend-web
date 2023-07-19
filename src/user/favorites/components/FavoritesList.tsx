import { ReactElement, useCallback, useContext, useMemo, useRef } from 'react';
import { JourneyRef, journeyRefKeyMap } from '../../journey/models/JourneyRef';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { InfiniteListing, NetworkedInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { MinimalJourney, minimalJourneyKeyMap } from '../lib/MinimalJourney';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../admin/crud/CrudFetcher';
import { HistoryItem } from './HistoryItem';
import styles from './shared.module.css';
import { InfiniteList } from '../../../shared/components/InfiniteList';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';

export type FavoritesListProps = {
  /**
   * A function which can be called to take the user to the given journey
   * then return when they are done.
   *
   * @param journey The journey to show.
   */
  showJourney: (journey: JourneyRef) => void;

  /**
   * The height of the list in logical pixels
   */
  listHeight: ValueWithCallbacks<number>;

  /**
   * The handler to use to fetch images.
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Displays an infinite list of the given height, where the contents are favorited
 * journeys.
 */
export const FavoritesList = ({
  showJourney,
  listHeight,
  imageHandler,
}: FavoritesListProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const loginContextRef = useRef(loginContext);
  loginContextRef.current = loginContext;
  const windowSize = useWindowSize();

  const infiniteListing = useMemo<InfiniteListing<MinimalJourney>>(() => {
    const numVisible = Math.ceil(windowSize.height / 80) + 15;
    const result = new NetworkedInfiniteListing<MinimalJourney>(
      '/api/1/users/me/search_history',
      Math.min(numVisible * 2 + 10, 150),
      numVisible,
      10,
      {
        liked_at: {
          operator: 'neq',
          value: null,
        },
      },
      [
        {
          key: 'liked_at',
          dir: 'desc',
          before: null,
          after: null,
        },
        {
          key: 'uid',
          dir: 'asc',
          before: null,
          after: null,
        },
      ],
      (item, dir) => {
        return [
          {
            key: 'liked_at',
            dir: dir === 'before' ? 'asc' : 'desc',
            before: null,
            after: item.likedAt === null ? null : item.likedAt.getTime() / 1000,
          },
          {
            key: 'uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.uid,
          },
        ];
      },
      minimalJourneyKeyMap,
      () => loginContextRef.current
    );
    result.reset();
    return result;
  }, [windowSize.height]);

  const loading = useRef<boolean>(false);
  const gotoJourneyByUID = useCallback(
    async (uid: string) => {
      if (loading.current) {
        return;
      }
      if (loginContext.state !== 'logged-in') {
        return;
      }

      loading.current = true;
      try {
        const response = await apiFetch(
          '/api/1/users/me/start_journey_from_history',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              journey_uid: uid,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          console.log(
            'failed to start journey from history:',
            response.status,
            await response.text()
          );
          return;
        }
        const raw = await response.json();
        const journey = convertUsingKeymap(raw, journeyRefKeyMap);
        showJourney(journey);
      } finally {
        loading.current = false;
      }
    },
    [loginContext, showJourney]
  );

  const boundComponent = useMemo<
    (
      item: ValueWithCallbacks<MinimalJourney>,
      setItem: (newItem: MinimalJourney) => void,
      visible: ValueWithCallbacks<{ items: MinimalJourney[]; index: number }>
    ) => ReactElement
  >(() => {
    return (item, setItem, visible) => (
      <HistoryItemComponent
        gotoJourneyByUid={gotoJourneyByUID}
        item={item}
        setItem={setItem}
        visible={visible}
        instructorImages={imageHandler}
      />
    );
  }, [gotoJourneyByUID, imageHandler]);

  return (
    <RenderGuardedComponent
      props={listHeight}
      component={(listHeight) => (
        <InfiniteList
          listing={infiniteListing}
          component={boundComponent}
          itemComparer={compareHistoryItems}
          height={listHeight}
          gap={10}
          initialComponentHeight={75}
          emptyElement={
            <div className={styles.empty}>You don&rsquo;t have any favorite classes yet</div>
          }
        />
      )}
    />
  );
};

const compareHistoryItems = (a: MinimalJourney, b: MinimalJourney): boolean => a.uid === b.uid;

const HistoryItemComponent = ({
  gotoJourneyByUid,
  item,
  setItem,
  visible,
  instructorImages,
}: {
  gotoJourneyByUid: (uid: string) => void;
  item: ValueWithCallbacks<MinimalJourney>;
  setItem: (item: MinimalJourney) => void;
  visible: ValueWithCallbacks<{ items: MinimalJourney[]; index: number }>;
  instructorImages: OsehImageStateRequestHandler;
}): ReactElement => {
  const gotoJourney = useCallback(() => {
    gotoJourneyByUid(item.get().uid);
  }, [gotoJourneyByUid, item]);
  const separator = useWritableValueWithCallbacks(() => false);

  return (
    <HistoryItem
      item={item}
      setItem={setItem}
      separator={separator}
      onClick={gotoJourney}
      instructorImages={instructorImages}
    />
  );
};
