import { ReactElement, useCallback, useContext } from 'react';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { IconButton } from '../../../../shared/forms/IconButton';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { FeatureComponentProps } from '../../models/Feature';
import styles from './SeriesDetails.module.css';
import { SeriesDetailsResources } from './SeriesDetailsResources';
import { SeriesDetailsState } from './SeriesDetailsState';
import { useUnwrappedValueWithCallbacks } from '../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { Button } from '../../../../shared/forms/Button';
import { CourseJourney } from '../../../series/components/CourseJourney';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useWorkingModal } from '../../../../shared/hooks/useWorkingModal';
import { MinimalCourseJourney } from '../../../favorites/lib/MinimalCourseJourney';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { journeyRefKeyMap } from '../../../journey/models/JourneyRef';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';

export const SeriesDetails = ({
  state,
  resources,
}: FeatureComponentProps<SeriesDetailsState, SeriesDetailsResources>) => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);

  const showing = useMappedValueWithCallbacks(state, (s) => s.show);
  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.get().goBack();
    },
    [resources]
  );

  const hasEntitlementVWC = useMappedValueWithCallbacks(state, (s) => !!s.show?.hasEntitlement);

  const likedAtVWC = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.courseLikeState.likedAt, {
      outputEqualityFn: Object.is,
    })
  );

  const goingToJourney = useWritableValueWithCallbacks(() => false);
  useWorkingModal(modalContext.modals, goingToJourney);

  const gotoJourneyError = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, gotoJourneyError, 'going to journey');

  const handleJourneyClick = useCallback(
    async (association: MinimalCourseJourney): Promise<void> => {
      const series = state.get().show;
      if (series === null || series === undefined || !series.hasEntitlement) {
        return;
      }

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      if (goingToJourney.get()) {
        return;
      }

      setVWC(goingToJourney, true);
      setVWC(gotoJourneyError, null);
      try {
        if (series.joinedAt === null) {
          const response = await apiFetch(
            '/api/1/courses/attach_via_jwt',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                course_uid: series.uid,
                course_jwt: series.jwt,
              }),
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          state.get().setShow({ ...series, joinedAt: new Date() }, false);
        }
        const resp = await apiFetch(
          '/api/1/courses/start_journey',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              journey_uid: association.journey.uid,
              course_uid: series.uid,
              course_jwt: series.jwt,
            }),
          },
          loginContext
        );
        if (!resp.ok) {
          throw resp;
        }
        const data = await resp.json();
        const journey = convertUsingMapper(data, journeyRefKeyMap);
        resources.get().gotoJourney(journey, series);
      } catch (e) {
        const err = await describeError(e);
        setVWC(gotoJourneyError, err);
      } finally {
        setVWC(goingToJourney, false);
      }
    },
    [goingToJourney, gotoJourneyError, loginContextRaw.value, resources, state]
  );

  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect([contentRef, windowSizeVWC], () => {
    const ele = contentRef.get();
    const height = windowSizeVWC.get().height;

    if (ele !== null) {
      ele.style.minHeight = `${height}px`;
    }
    return undefined;
  });

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(resources, (r) => r.backgroundImage)}
        />
      </div>
      <div className={styles.content} ref={(r) => setVWC(contentRef, r)}>
        <div className={styles.closeContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
        </div>
        <div className={styles.contentInner}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <RenderGuardedComponent
                props={useMappedValueWithCallbacks(showing, (s) => s?.title)}
                component={(title) => (
                  <>
                    <div className={styles.title}>{title}</div>
                  </>
                )}
              />
              <RenderGuardedComponent
                props={useMappedValueWithCallbacks(showing, (s) => s?.instructor?.name)}
                component={(instructor) => (
                  <>
                    <div className={styles.instructor}>{instructor}</div>
                  </>
                )}
              />
            </div>
            <div className={styles.headerRight}>
              <RenderGuardedComponent
                props={likedAtVWC}
                component={(likedAt) =>
                  likedAt === undefined ? (
                    <></>
                  ) : likedAt === null ? (
                    <IconButton
                      icon={styles.emptyHeartIcon}
                      srOnlyName="Like"
                      onClick={(e) => {
                        e.preventDefault();
                        resources.get().courseLikeState.like();
                      }}
                    />
                  ) : (
                    <IconButton
                      icon={styles.fullHeartIcon}
                      srOnlyName="Unlike"
                      onClick={(e) => {
                        e.preventDefault();
                        resources.get().courseLikeState.unlike();
                      }}
                    />
                  )
                }
              />
            </div>
          </div>
          <div className={styles.description}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(showing, (s) => s?.description)}
              component={(description) => <div>{description}</div>}
            />
          </div>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(
              showing,
              (s) =>
                s !== undefined &&
                s !== null &&
                !s.hasEntitlement &&
                s.revenueCatEntitlement === 'pro'
            )}
            component={(showUpgrade) =>
              !showUpgrade ? (
                <></>
              ) : (
                <div className={styles.upgradeContainer}>
                  <Button
                    type="button"
                    variant="filled-premium"
                    onClick={(e) => {
                      e.preventDefault();
                      resources.get().gotoUpgrade();
                    }}>
                    Unlock with OSEH+
                  </Button>
                </div>
              )
            }
          />
          <div className={styles.classes}>
            <div className={styles.classesTitle}>
              <RenderGuardedComponent
                props={useMappedValueWithCallbacks(showing, (s) =>
                  s?.numJourneys?.toLocaleString()
                )}
                component={(numJourneys) => <>{numJourneys} </>}
              />
              Classes
            </div>
            <div className={styles.classList}>
              <RenderGuardedComponent
                props={useMappedValuesWithCallbacks([resources, hasEntitlementVWC], () => ({
                  journeys: resources.get().journeys,
                  hasEntitlement: hasEntitlementVWC.get(),
                }))}
                component={({ journeys, hasEntitlement }) => (
                  <>
                    {journeys === null ? (
                      <div className={styles.classesPlaceholder}>
                        An error occurred, try reloading
                      </div>
                    ) : journeys === undefined ? (
                      <div className={styles.classesPlaceholder}>Loading...</div>
                    ) : journeys.length === 0 ? (
                      <div className={styles.classesPlaceholder}>No classes found</div>
                    ) : (
                      journeys.map((association, idx) => (
                        <button
                          key={association.priority}
                          className={styles.classButton}
                          onClick={(e) => {
                            e.preventDefault();
                            handleJourneyClick(association);
                          }}
                          disabled={!hasEntitlement}>
                          <CourseJourney
                            association={association}
                            index={idx}
                            imageHandler={resources.get().imageHandler}
                          />
                        </button>
                      ))
                    )}
                  </>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
