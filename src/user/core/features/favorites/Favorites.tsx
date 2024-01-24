import { ReactElement, useCallback, useContext } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { FavoritesResources } from './FavoritesResources';
import { FavoritesState } from './FavoritesState';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { JourneyRef } from '../../../journey/models/JourneyRef';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { JourneyRouter } from '../../../journey/JourneyRouter';
import styles from './Favorites.module.css';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { IconButton } from '../../../../shared/forms/IconButton';
import { MyProfilePicture } from '../../../../shared/components/MyProfilePicture';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { FavoritesList } from '../../../favorites/components/FavoritesList';
import { HistoryList } from '../../../favorites/components/HistoryList';
import { CourseJourneysList } from '../../../favorites/components/CourseJourneysList';

/**
 * The top-level component which shows the favorites/history/courses tabbed pane.
 *
 * @returns
 */
export const Favorites = ({
  state: stateVWC,
  resources: resourcesVWC,
}: FeatureComponentProps<FavoritesState, FavoritesResources>): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const imageHandler = useOsehImageStateRequestHandler({});
  const journeyVWC = useWritableValueWithCallbacks<JourneyRef | null>(() => null);
  const listHeight = useMappedValueWithCallbacks(
    windowSizeVWC,
    (windowSize) => windowSize.height - 189
  );

  const gotoFavorites = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stateVWC.get().setTab('favorites', true);
    },
    [stateVWC]
  );

  const gotoHistory = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stateVWC.get().setTab('history', true);
    },
    [stateVWC]
  );

  const gotoCourses = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stateVWC.get().setTab('courses', true);
    },
    [stateVWC]
  );

  const onJourneyFinished = useCallback(() => {
    setVWC(journeyVWC, null);
  }, [journeyVWC]);

  const setJourney = useCallback(
    (journey: JourneyRef) => {
      setVWC(journeyVWC, journey);
    },
    [journeyVWC]
  );
  const tabVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.tab);
  const background = useMappedValueWithCallbacks(resourcesVWC, (r) => r.background);

  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stateVWC.get().setShow(false, true);
    },
    [stateVWC]
  );

  return (
    <RenderGuardedComponent
      props={journeyVWC}
      component={(journey) => {
        if (journey !== null) {
          return (
            <JourneyRouter
              journey={journey}
              onFinished={onJourneyFinished}
              isOnboarding={false}
              takeAnother={null}
            />
          );
        }

        return (
          <div className={styles.container}>
            <div className={styles.imageContainer}>
              <OsehImageFromStateValueWithCallbacks state={background} />
            </div>
            <div className={styles.closeButtonContainer}>
              <div className={styles.closeButtonInnerContainer}>
                <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
              </div>
            </div>
            <div className={styles.content}>
              <div className={styles.profile}>
                <div className={styles.profilePictureContainer}>
                  <MyProfilePicture imageHandler={imageHandler} />
                </div>
                <div className={styles.profileName}>
                  <RenderGuardedComponent
                    props={loginContextRaw.value}
                    component={(loginContextUnch) => (
                      <>
                        {loginContextUnch.state === 'logged-in' &&
                          loginContextUnch.userAttributes?.name}
                      </>
                    )}
                  />
                </div>
              </div>
              <RenderGuardedComponent
                props={tabVWC}
                component={(tab) => (
                  <>
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
                  </>
                )}
              />
            </div>
          </div>
        );
      }}
    />
  );
};
