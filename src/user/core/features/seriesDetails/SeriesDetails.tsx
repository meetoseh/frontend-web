import { useCallback } from 'react';
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

export const SeriesDetails = ({
  state,
  resources,
}: FeatureComponentProps<SeriesDetailsState, SeriesDetailsResources>) => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const backgroundRefVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([windowSizeVWC, backgroundRefVWC], () => {
    const size = windowSizeVWC.get();
    const bknd = backgroundRefVWC.get();

    if (bknd !== null) {
      bknd.style.minHeight = `${size.height}px`;
    }
    return undefined;
  });

  const showing = useMappedValueWithCallbacks(state, (s) => s.show);
  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      state.get().setShow(null, true);
    },
    [state]
  );

  const likedAtVWC = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.courseLikeState.likedAt, {
      outputEqualityFn: Object.is,
    })
  );

  return (
    <div className={styles.container}>
      <div className={styles.background} ref={(v) => setVWC(backgroundRefVWC, v)} />
      <div className={styles.content}>
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
              (s) => s !== undefined && s !== null && !s.hasEntitlement
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
                props={useMappedValueWithCallbacks(resources, (r) => r.journeys)}
                component={(journeys) => (
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
                        <CourseJourney
                          association={association}
                          index={idx}
                          imageHandler={resources.get().imageHandler}
                          key={association.priority}
                        />
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
