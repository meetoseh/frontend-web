import { ReactElement, useCallback, useContext, useMemo, useRef } from 'react';
import { JourneyRef, journeyRefKeyMap } from '../../journey/models/JourneyRef';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { MinimalJourney } from '../lib/MinimalJourney';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../admin/crud/CrudFetcher';
import { HistoryItem } from './HistoryItem';
import styles from './shared.module.css';
import { InfiniteList } from '../../../shared/components/InfiniteList';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useHistoryList } from '../hooks/useHistoryList';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';

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

  const infiniteListing = useHistoryList(
    { type: 'react-rerender', props: loginContext },
    adaptValueWithCallbacksAsVariableStrategyProps(listHeight)
  );

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
      previous: ValueWithCallbacks<MinimalJourney | null>
    ) => ReactElement
  >(() => {
    return (item, setItem, previous) => (
      <HistoryItemComponent
        gotoJourneyByUid={gotoJourneyByUID}
        item={item}
        setItem={setItem}
        previous={previous}
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
  previous,
  instructorImages,
}: {
  gotoJourneyByUid: (uid: string) => void;
  item: ValueWithCallbacks<MinimalJourney>;
  setItem: (item: MinimalJourney) => void;
  previous: ValueWithCallbacks<MinimalJourney | null>;
  instructorImages: OsehImageStateRequestHandler;
}): ReactElement => {
  const gotoJourney = useCallback(() => {
    gotoJourneyByUid(item.get().uid);
  }, [gotoJourneyByUid, item]);

  const separator = useMappedValuesWithCallbacks([item, previous], () => {
    const prev = previous.get();
    const itm = item.get();

    return (
      prev === null ||
      prev.lastTakenAt?.toLocaleDateString() !== itm.lastTakenAt?.toLocaleDateString()
    );
  });

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
