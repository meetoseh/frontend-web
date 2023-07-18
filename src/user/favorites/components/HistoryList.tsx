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
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';

export type HistoryListProps = {
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
 * Displays an infinite list of the given height, where the contents are journeys
 * the user has taken previously.
 */
export const HistoryList = ({
  showJourney,
  listHeight,
  imageHandler,
}: HistoryListProps): ReactElement => {
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
      {},
      [
        {
          key: 'last_taken_at',
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
            key: 'last_taken_at',
            dir: dir === 'before' ? 'asc' : 'desc',
            before: null,
            after: item.lastTakenAt === null ? null : item.lastTakenAt.getTime() / 1000,
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
      item: MinimalJourney,
      setItem: (newItem: MinimalJourney) => void,
      items: MinimalJourney[],
      index: number
    ) => ReactElement
  >(() => {
    return (item, setItem, items, index) => (
      <HistoryItemComponent
        gotoJourneyByUid={gotoJourneyByUID}
        item={item}
        setItem={setItem}
        items={items}
        index={index}
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
          emptyElement={<div className={styles.empty}>You haven&rsquo;t taken any classes yet</div>}
          keyFn={journeyKeyFn}
        />
      )}
    />
  );
};

const compareHistoryItems = (a: MinimalJourney, b: MinimalJourney): boolean => a.uid === b.uid;
const journeyKeyFn = (item: MinimalJourney): string => item.uid;

const HistoryItemComponent = ({
  gotoJourneyByUid,
  item,
  setItem,
  items,
  index,
  instructorImages,
}: {
  gotoJourneyByUid: (uid: string) => void;
  item: MinimalJourney;
  setItem: (item: MinimalJourney) => void;
  items: MinimalJourney[];
  index: number;
  instructorImages: OsehImageStateRequestHandler;
}): ReactElement => {
  const gotoJourney = useCallback(() => {
    gotoJourneyByUid(item.uid);
  }, [gotoJourneyByUid, item.uid]);

  return (
    <HistoryItem
      item={item}
      setItem={setItem}
      separator={
        index === 0 ||
        items[index - 1].lastTakenAt?.toLocaleDateString() !==
          item.lastTakenAt?.toLocaleDateString()
      }
      onClick={gotoJourney}
      instructorImages={instructorImages}
    />
  );
};
