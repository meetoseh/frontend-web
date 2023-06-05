import { ReactElement, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { OsehImageFromState, OsehImageState } from '../../../shared/OsehImage';
import styles from './FavoritesTabbedPane.module.css';
import { MyProfilePicture } from '../../../shared/MyProfilePicture';
import { LoginContext } from '../../../shared/LoginContext';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { InfiniteListing, NetworkedInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { MinimalJourney, minimalJourneyKeyMap } from '../lib/MinimalJourney';
import { InfiniteList } from '../../../shared/components/InfiniteList';
import { HistoryItem } from '../components/HistoryItem';
import { IconButton } from '../../../shared/forms/IconButton';

export type FavoritesTabbedPaneProps = {
  /**
   * The background image to use. We have this passed in as a prop
   * to get a smoother loading experience.
   */
  background: OsehImageState;
};

export const FavoritesTabbedPane = ({ background }: FavoritesTabbedPaneProps): ReactElement => {
  const [tab, setTab] = useState<'favorites' | 'history'>('history');
  const loginContext = useContext(LoginContext);
  const loginContextRef = useRef(loginContext);
  loginContextRef.current = loginContext;
  const windowSize = useWindowSize();

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

  const gotoFavorites = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('favorites');
  }, []);

  const gotoHistory = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('history');
  }, []);

  const listHeight = windowSize.height - 189;

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
            component={HistoryItemComponent}
            itemComparer={compareHistoryItems}
            height={listHeight}
            gap={10}
          />
        </div>
      </div>
    </div>
  );
};

const compareHistoryItems = (a: MinimalJourney, b: MinimalJourney): boolean => a.uid === b.uid;

const HistoryItemComponent = (
  item: MinimalJourney,
  setItem: (item: MinimalJourney) => void
): ReactElement => <HistoryItem item={item} setItem={setItem} />;
