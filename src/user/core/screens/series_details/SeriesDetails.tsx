import { Fragment, ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import {
  TransitionPropAsOwner,
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { SeriesDetailsResources } from './SeriesDetailsResources';
import { SeriesDetailsMappedParams } from './SeriesDetailsParams';
import styles from './SeriesDetails.module.css';
import { Back } from './icons/Back';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useFavoritedModal } from '../../../favorites/hooks/useFavoritedModal';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { CourseLikeState } from '../../../series/lib/createSeriesLikeStateRequestHandler';
import { useUnfavoritedModal } from '../../../favorites/hooks/useUnfavoritedModal';
import { EmptyHeartIcon } from './icons/EmptyHeartIcon';
import { FullHeartIcon } from './icons/FullHeartIcon';
import { setVWC } from '../../../../shared/lib/setVWC';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { Button } from '../../../../shared/forms/Button';
import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { MinimalCourseJourney } from '../../../favorites/lib/MinimalCourseJourney';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { Check } from './icons/Check';
import { formatDurationClock } from '../../../../shared/lib/networkResponseUtils';

/**
 * Displays the series details page on a specific series
 */
export const SeriesDetails = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'series_details',
  SeriesDetailsResources,
  SeriesDetailsMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridImageBackground image={resources.background} thumbhash={resources.backgroundThumbhash} />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}>
        <div style={{ height: '20px' }} />
        <div className={styles.backWrapper}>
          <button
            type="button"
            className={styles.back}
            onClick={async (e) => {
              e.preventDefault();
              if (workingVWC.get()) {
                return;
              }

              setVWC(workingVWC, true);
              const finishPop = startPop(
                screen.parameters.buttons.back.trigger === null
                  ? null
                  : {
                      slug: screen.parameters.buttons.back.trigger,
                      parameters: {},
                    }
              );
              setVWC(transition.animation, screen.parameters.buttons.back.exit);
              await playExitTransition(transition).promise;
              finishPop();
            }}>
            <span className={assistiveStyles.srOnly}>Back</span>
            <Back />
          </button>
        </div>
        <div style={{ height: '20px' }} />
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.title}>{screen.parameters.series.title}</div>
            <div style={{ height: '2px' }} />
            <div className={styles.instructor}>{screen.parameters.series.instructor.name}</div>
          </div>
          <div className={styles.headerRight}>
            <RenderGuardedComponent
              props={resources.likeState}
              component={(likeState) => {
                if (likeState === null) {
                  return <></>;
                }

                return <Heart state={likeState} />;
              }}
            />
          </div>
        </div>
        <div style={{ height: '24px' }} />
        <div className={styles.description}>{screen.parameters.series.description}</div>
        {!screen.parameters.series.hasEntitlement &&
          screen.parameters.series.revenueCatEntitlement === 'pro' && (
            <>
              <div style={{ height: '24px' }} />
              <Button
                type="button"
                variant="filled-premium"
                onClick={async (e) => {
                  e.preventDefault();
                  if (workingVWC.get()) {
                    return;
                  }

                  setVWC(workingVWC, true);
                  const finishPop =
                    screen.parameters.buttons.buyNow.trigger === null
                      ? startPop(null)
                      : startPop(
                          {
                            slug: screen.parameters.buttons.buyNow.trigger,
                            parameters: {
                              series: {
                                uid: screen.parameters.series.uid,
                                jwt: screen.parameters.series.jwt,
                              },
                            },
                          },
                          '/api/1/users/me/screens/pop_to_series'
                        );
                  setVWC(transition.animation, screen.parameters.buttons.buyNow.exit);
                  await playExitTransition(transition).promise;
                  finishPop();
                }}>
                Unlock with OSEH+
              </Button>
            </>
          )}
        <div style={{ height: '24px' }} />
        <div className={styles.numClasses}>
          {screen.parameters.series.numJourneys.toLocaleString()} Classes
        </div>
        <div style={{ height: '8px' }} />
        <div className={styles.classes}>
          {Array(screen.parameters.series.numJourneys)
            .fill(null)
            .map((_, idx) => {
              return (
                <Fragment key={idx}>
                  {idx > 0 && <div style={{ height: '8px' }} />}
                  <Journey
                    ctx={ctx}
                    screen={screen}
                    resources={resources}
                    startPop={startPop}
                    trace={trace}
                    transition={transition}
                    idx={idx}
                  />
                </Fragment>
              );
            })}
        </div>
        <div style={{ height: '24px' }} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};

const Journey = ({
  ctx,
  screen,
  resources,
  idx,
  startPop,
  transition,
}: ScreenComponentProps<'series_details', SeriesDetailsResources, SeriesDetailsMappedParams> & {
  idx: number;
  transition: TransitionPropAsOwner<StandardScreenTransition['type'], StandardScreenTransition>;
}): ReactElement => {
  const backgroundVWC = useWritableValueWithCallbacks<OsehImageExportCropped | null>(() => null);
  useValueWithCallbacksEffect(resources.journeyBackgrounds, (vwcs) => {
    const vwc = vwcs[idx];
    if (vwc === null || vwc === undefined) {
      setVWC(backgroundVWC, null);
      return undefined;
    }

    return createValueWithCallbacksEffect(vwc, (v) => {
      setVWC(backgroundVWC, v);
      return undefined;
    });
  });

  const heightVWC = useWritableValueWithCallbacks<number | null>(() => null);
  useValueWithCallbacksEffect(heightVWC, (h) => {
    if (h === null) {
      return undefined;
    }

    const heights = resources.journeyBackgroundHeights.get();
    const expectedHeightVWC = heights[idx];
    if (expectedHeightVWC === null || expectedHeightVWC === undefined) {
      return undefined;
    }

    setVWC(expectedHeightVWC, h);
    return undefined;
  });

  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValueWithCallbacksEffect(containerRef, (eleRaw) => {
    if (eleRaw === null) {
      return undefined;
    }

    const ele = eleRaw;
    if (window.ResizeObserver) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setVWC(heightVWC, entry.contentRect.height);
        }
      });
      ro.observe(ele);
      return () => {
        ro.disconnect();
      };
    } else {
      return createValueWithCallbacksEffect(ctx.windowSizeImmediate, () => {
        setVWC(heightVWC, ele.clientHeight);
        return undefined;
      });
    }
  });

  const journeyVWC = useWritableValueWithCallbacks<MinimalCourseJourney | null>(() => null);
  useValueWithCallbacksEffect(resources.journeys, (course) => {
    if (course === null) {
      setVWC(journeyVWC, null);
      return undefined;
    }

    const journey = course.journeys[idx];
    setVWC(journeyVWC, journey ?? null);
  });

  const takenBeforeVWC = useMappedValueWithCallbacks(
    journeyVWC,
    (j) => j !== null && j.journey.lastTakenAt !== null
  );

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const inner = (
    <div className={styles.journey} ref={(r) => setVWC(containerRef, r)}>
      <GridImageBackground image={backgroundVWC} />
      <div className={styles.journeyForeground}>
        <div className={styles.journeyHeader}>
          <div className={styles.journeyHeaderLeft}>
            <RenderGuardedComponent
              props={takenBeforeVWC}
              component={(takenBefore) => (!takenBefore ? <></> : <Check />)}
            />
            <div className={styles.journeyCounter}>{(idx + 1).toLocaleString()}.</div>
            <div className={styles.journeyTitle}>
              <RenderGuardedComponent
                props={useMappedValueWithCallbacks(journeyVWC, (j) => j?.journey?.title ?? '')}
                component={(title) => <>{title}</>}
              />
            </div>
          </div>
          <div className={styles.journeyHeaderRight}>
            <RenderGuardedComponent
              props={takenBeforeVWC}
              component={(takenBefore) =>
                takenBefore ? <div className={styles.journeyPlayedText}>Played</div> : <></>
              }
            />
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(
                journeyVWC,
                (j) => j?.journey?.durationSeconds ?? 0
              )}
              component={(durationSeconds) => (
                <div className={styles.journeyDuration}>
                  {formatDurationClock(durationSeconds, {
                    minutes: true,
                    seconds: true,
                    milliseconds: false,
                  })}
                </div>
              )}
            />
          </div>
        </div>
        <div style={{ height: '7px' }} />
        <div className={styles.journeyDescriptionWrapper}>
          <div className={styles.journeyDescription}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(journeyVWC, (j) => j?.journey?.description ?? '')}
              component={(description) => <>{description}</>}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return screen.parameters.series.hasEntitlement ? (
    <button
      type="button"
      className={styles.journeyButton}
      onClick={async (e) => {
        e.preventDefault();
        if (workingVWC.get()) {
          return;
        }

        const journey = journeyVWC.get();
        if (journey === null) {
          return;
        }

        setVWC(workingVWC, true);
        const finishPop =
          screen.parameters.buttons.takeClass.trigger === null
            ? startPop(null)
            : startPop(
                {
                  slug: screen.parameters.buttons.takeClass.trigger,
                  parameters: {
                    series: {
                      uid: screen.parameters.series.uid,
                      jwt: screen.parameters.series.jwt,
                    },
                    journey: {
                      uid: journey.journey.uid,
                    },
                  },
                },
                '/api/1/users/me/screens/pop_to_series_class'
              );
        setVWC(transition.animation, screen.parameters.buttons.takeClass.exit);
        await playExitTransition(transition).promise;
        finishPop();
      }}>
      {inner}
    </button>
  ) : (
    inner
  );
};

const Heart = ({ state }: { state: CourseLikeState }): ReactElement => {
  useFavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(state.showLikedUntil));
  useUnfavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(state.showUnlikedUntil));

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <RenderGuardedComponent
      props={state.likedAt}
      component={(likedAt) => {
        if (likedAt === undefined) {
          return <></>;
        }

        return (
          <RenderGuardedComponent
            props={workingVWC}
            component={(disabled) => (
              <button
                type="button"
                className={styles.heart}
                onClick={async (e) => {
                  e.preventDefault();
                  setVWC(workingVWC, true);
                  try {
                    await state.toggleLike().promise;
                  } finally {
                    setVWC(workingVWC, false);
                  }
                }}
                disabled={disabled}>
                <span className={assistiveStyles.srOnly}>
                  {likedAt === null ? 'Like' : 'Remove Like'}
                </span>
                {likedAt === null ? <EmptyHeartIcon /> : <FullHeartIcon />}
              </button>
            )}
          />
        );
      }}
    />
  );
};
