import { ReactElement, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  OsehImageFromState,
  OsehImageState,
  OsehImageStatesRef,
  useOsehImageStatesRef,
} from '../../../shared/OsehImage';
import styles from './FavoritesTabbedPane.module.css';
import { MyProfilePicture } from '../../../shared/MyProfilePicture';
import { LoginContext } from '../../../shared/LoginContext';
import { combineClasses } from '../../../shared/lib/combineClasses';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
  ProceduralInfiniteListing,
} from '../../../shared/lib/InfiniteListing';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { MinimalJourney, minimalJourneyKeyMap } from '../lib/MinimalJourney';
import { InfiniteList } from '../../../shared/components/InfiniteList';
import { HistoryItem } from '../components/HistoryItem';
import { IconButton } from '../../../shared/forms/IconButton';
import { JourneyRef, journeyRefKeyMap } from '../../journey/models/JourneyRef';
import { JourneyRouter } from '../../journey/JourneyRouter';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../admin/crud/CrudFetcher';

export type FavoritesTabbedPaneProps = {
  /**
   * The background image to use. We have this passed in as a prop
   * to get a smoother loading experience.
   */
  background: OsehImageState;
};

export const FavoritesTabbedPane = ({ background }: FavoritesTabbedPaneProps): ReactElement => {
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');
  const loginContext = useContext(LoginContext);
  const loginContextRef = useRef(loginContext);
  loginContextRef.current = loginContext;
  const windowSize = useWindowSize();
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const instructorImages = useOsehImageStatesRef({ cacheSize: 128 });

  const infiniteListing = useMemo<InfiniteListing<MinimalJourney>>(() => {
    const numVisible = Math.ceil(windowSize.height / 80) + 5;
    const result = new NetworkedInfiniteListing<MinimalJourney>(
      '/api/1/users/me/search_history',
      Math.min(numVisible * 2, 150),
      numVisible,
      tab === 'favorites'
        ? {
            liked_at: {
              operator: 'neq',
              value: null,
            },
          }
        : {},
      [
        {
          key: tab === 'favorites' ? 'liked_at' : 'last_taken_at',
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
  }, [tab, windowSize.height]);

  // const infiniteListing = useMemo<InfiniteListing<MinimalJourney>>(() => {
  //   const startAt = Date.now();
  //   const result = new ProceduralInfiniteListing<MinimalJourney>(
  //     (idx) => ({
  //       uid: `uid-${idx}`,
  //       title: `Title ${idx}`,
  //       instructor: {
  //         name: `Instructor ${idx}`,
  //         image: {
  //           uid: 'oseh_if_y2J1TPz5VhUUsk8I0ofPwg',
  //           jwt: null,
  //         },
  //       },
  //       lastTakenAt: new Date(startAt - idx * 1000 * 60 * 60 * 3),
  //       likedAt: idx % 3 === 0 ? new Date(startAt - idx * 1000 * 60 * 60 * 3) : null,
  //     }),
  //     Math.ceil(windowSize.height / 80) + 5
  //   );
  //   result.reset();
  //   return result;
  // }, [windowSize.height]);

  const gotoFavorites = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('favorites');
  }, []);

  const gotoHistory = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('history');
  }, []);

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
        setJourney(journey);
      } finally {
        loading.current = false;
      }
    },
    [loginContext]
  );

  const onJourneyFinished = useCallback(() => {
    setJourney(null);
  }, []);

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
        useSeparators={tab === 'history'}
        gotoJourneyByUid={gotoJourneyByUID}
        item={item}
        setItem={setItem}
        items={items}
        index={index}
        instructorImages={instructorImages}
      />
    );
  }, [tab, gotoJourneyByUID, instructorImages]);

  const listHeight = windowSize.height - 189;

  if (journey !== null) {
    return <JourneyRouter journey={journey} onFinished={onJourneyFinished} isOnboarding={false} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick="/" />
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.profile}>
          <div className={styles.profilePictureContainer}>
            <MyProfilePicture />
          </div>
          <div className={styles.profileName}>{loginContext.userAttributes?.name}</div>
        </div>
        <div className={styles.tabs}>
          <button
            type="button"
            onClick={gotoFavorites}
            className={combineClasses(
              styles.tab,
              tab === 'favorites' ? styles.activeTab : undefined
            )}>
            Favorites
          </button>
          <button
            type="button"
            onClick={gotoHistory}
            className={combineClasses(
              styles.tab,
              tab === 'history' ? styles.activeTab : undefined
            )}>
            History
          </button>
        </div>
        <div className={styles.tabContent}>
          <InfiniteList
            listing={infiniteListing}
            component={boundComponent}
            itemComparer={compareHistoryItems}
            height={listHeight}
            gap={10}
            initialComponentHeight={75}
            emptyElement={
              <div className={styles.empty}>
                {tab === 'favorites' ? (
                  <>You don&rsquo;t have any favorite classes yet</>
                ) : (
                  <>You haven&rsquo;t taken any classes yet</>
                )}
              </div>
            }
            keyFn={journeyKeyFn}
          />
        </div>
      </div>
    </div>
  );
};

const compareHistoryItems = (a: MinimalJourney, b: MinimalJourney): boolean => a.uid === b.uid;
const journeyKeyFn = (item: MinimalJourney): string => item.uid;

const HistoryItemComponent = ({
  useSeparators,
  gotoJourneyByUid,
  item,
  setItem,
  items,
  index,
  instructorImages,
}: {
  useSeparators: boolean;
  gotoJourneyByUid: (uid: string) => void;
  item: MinimalJourney;
  setItem: (item: MinimalJourney) => void;
  items: MinimalJourney[];
  index: number;
  instructorImages: OsehImageStatesRef;
}): ReactElement => {
  const gotoJourney = useCallback(() => {
    gotoJourneyByUid(item.uid);
  }, [gotoJourneyByUid, item.uid]);

  return (
    <HistoryItem
      item={item}
      setItem={setItem}
      separator={
        useSeparators &&
        (index === 0 ||
          items[index - 1].lastTakenAt?.toLocaleDateString() !==
            item.lastTakenAt?.toLocaleDateString())
      }
      onClick={gotoJourney}
      instructorImages={instructorImages}
    />
  );
};
