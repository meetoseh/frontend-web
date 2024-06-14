import { Fragment, ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import {
  TransitionPropAsOwner,
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
import { trackClassTaken } from '../home/lib/trackClassTaken';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { screenOut } from '../../lib/screenOut';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';

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
        <VerticalSpacer height={20} />
        <div className={styles.backWrapper}>
          <button
            type="button"
            className={styles.back}
            onClick={(e) => {
              e.preventDefault();
              screenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.buttons.back.exit,
                screen.parameters.buttons.back.trigger,
                {
                  beforeDone: async () => {
                    trace({ type: 'back' });
                  },
                }
              );
            }}>
            <span className={assistiveStyles.srOnly}>Back</span>
            <Back />
          </button>
        </div>
        <VerticalSpacer height={20} />
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.title}>{screen.parameters.series.title}</div>
            <VerticalSpacer height={2} />
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
        <VerticalSpacer height={24} />
        <div className={styles.description}>{screen.parameters.series.description}</div>
        {!screen.parameters.series.hasEntitlement &&
          screen.parameters.series.revenueCatEntitlement === 'pro' && (
            <>
              <VerticalSpacer height={24} />
              <Button
                type="button"
                variant="filled-premium"
                onClick={async (e) => {
                  e.preventDefault();
                  screenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.buttons.buyNow.exit,
                    screen.parameters.buttons.buyNow.trigger,
                    {
                      endpoint: '/api/1/users/me/screens/pop_to_series',
                      parameters: {
                        series: {
                          uid: screen.parameters.series.uid,
                          jwt: screen.parameters.series.jwt,
                        },
                      },
                      beforeDone: async () => {
                        trace({ type: 'upgrade' });
                      },
                    }
                  );
                }}>
                Unlock with OSEH+
              </Button>
            </>
          )}
        <VerticalSpacer height={24} />
        <div className={styles.numClasses}>
          {screen.parameters.series.numJourneys.toLocaleString()} Classes
        </div>
        <VerticalSpacer height={8} />
        {Array(screen.parameters.series.numJourneys)
          .fill(null)
          .map((_, idx) => {
            return (
              <Fragment key={idx}>
                {idx > 0 && <VerticalSpacer height={8} />}
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
        <VerticalSpacer height={24} />
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
  trace,
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
                takenBefore ? (
                  <>
                    <div className={styles.journeyPlayedText}>Played</div>
                    <HorizontalSpacer width={8} />
                  </>
                ) : (
                  <></>
                )
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
        <VerticalSpacer height={7} />
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.journeyDescription}>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(journeyVWC, (j) => j?.journey?.description ?? '')}
            component={(description) => <>{description}</>}
          />
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
      </div>
    </div>
  );

  return screen.parameters.series.hasEntitlement ? (
    <button
      type="button"
      className={styles.journeyButton}
      onClick={async (e) => {
        e.preventDefault();
        const journey = journeyVWC.get();
        if (journey === null) {
          return;
        }

        screenOut(
          workingVWC,
          startPop,
          transition,
          screen.parameters.buttons.takeClass.exit,
          screen.parameters.buttons.takeClass.trigger,
          {
            endpoint: '/api/1/users/me/screens/pop_to_series_class',
            parameters: {
              series: {
                uid: screen.parameters.series.uid,
                jwt: screen.parameters.series.jwt,
              },
              journey: {
                uid: journey.journey.uid,
              },
            },
            beforeDone: async () => {
              trace({ type: 'journey', uid: journey.journey.uid, title: journey.journey.title });
            },
            afterDone: () => {
              if (screen.parameters.buttons.takeClass.trigger !== null) {
                trackClassTaken(ctx);
              }
            },
          }
        );
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
