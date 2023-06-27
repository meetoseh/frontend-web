import { ReactElement, useCallback, useContext, useRef, useState } from 'react';
import styles from './FavoritesTabbedPane.module.css';
import { MyProfilePicture } from '../../../shared/components/MyProfilePicture';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { IconButton } from '../../../shared/forms/IconButton';
import { JourneyRef } from '../../journey/models/JourneyRef';
import { JourneyRouter } from '../../journey/JourneyRouter';
import { OsehImageState } from '../../../shared/images/OsehImageState';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { OsehImageFromState } from '../../../shared/images/OsehImageFromState';
import { FavoritesList } from '../components/FavoritesList';
import { HistoryList } from '../components/HistoryList';
import { CourseJourneysList } from '../components/CourseJourneysList';

export type FavoritesTabbedPaneProps = {
  /**
   * The background image to use. We have this passed in as a prop
   * to get a smoother loading experience.
   */
  background: OsehImageState;
};

export const FavoritesTabbedPane = ({ background }: FavoritesTabbedPaneProps): ReactElement => {
  const [tab, setTab] = useState<'favorites' | 'history' | 'courses'>('favorites');
  const loginContext = useContext(LoginContext);
  const loginContextRef = useRef(loginContext);
  loginContextRef.current = loginContext;
  const windowSize = useWindowSize();
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const imageHandler = useOsehImageStateRequestHandler({});

  const gotoFavorites = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('favorites');
  }, []);

  const gotoHistory = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('history');
  }, []);

  const gotoCourses = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTab('courses');
  }, []);

  const onJourneyFinished = useCallback(() => {
    setJourney(null);
  }, []);

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
            <MyProfilePicture imageHandler={imageHandler} />
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
          <button
            type="button"
            onClick={gotoCourses}
            className={combineClasses(
              styles.tab,
              tab === 'courses' ? styles.activeTab : undefined
            )}>
            Owned
          </button>
        </div>
        <div className={combineClasses(styles.tabContent, styles[`tabContent-${tab}`])}>
          {tab === 'favorites' && (
            <FavoritesList
              showJourney={setJourney}
              listHeight={listHeight}
              imageHandler={imageHandler}
            />
          )}
          {tab === 'history' && (
            <HistoryList
              showJourney={setJourney}
              listHeight={listHeight}
              imageHandler={imageHandler}
            />
          )}
          {tab === 'courses' && (
            <CourseJourneysList
              showJourney={setJourney}
              listHeight={listHeight}
              imageHandler={imageHandler}
            />
          )}
        </div>
      </div>
    </div>
  );
};
