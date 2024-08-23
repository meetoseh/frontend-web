import { Fragment, ReactElement, useCallback, useMemo } from 'react';
import { PeekedScreen, ScreenComponentProps } from '../../models/Screen';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { Button } from '../../../../shared/forms/Button';
import styles from './Library.module.css';
import { ScreenContext } from '../../hooks/useScreenContext';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
  PrefixedNetworkedInfiniteListing,
} from '../../../../shared/lib/InfiniteListing';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { InfiniteList } from '../../../../shared/components/InfiniteList';
import { LibraryResources } from './LibraryResources';
import { LibraryMappedParams } from './LibraryParams';
import { SearchPublicJourney } from './lib/SearchPublicJourney';
import { LibraryCard } from './components/LibraryCard';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { Filter } from '../../../../shared/components/icons/Filter';
import { OsehColors } from '../../../../shared/OsehColors';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { OnLayoutAdapter } from '../../../../shared/hooks/useLayoutSize';
import { convertLibraryFilterToAPI } from './lib/LibraryFilter';
import { Close } from '../../../../shared/components/icons/Close';
import { SearchPublicInstructor } from './lib/SearchPublicInstructor';
import { ScreenDynamicImage } from '../../components/ScreenDynamicImage';
import { HeartFilled } from '../../../../shared/components/icons/HeartFilled';
import { Check } from '../../../../shared/components/icons/Check';
import { trackClassTaken } from '../home/lib/trackClassTaken';
import { waitForValuesWithCallbacksCondition } from '../../../../shared/lib/waitForValueWithCallbacksCondition';

type TooltipPlaceholder = { readonly uid: 'tooltip' };

/**
 * Shows the list of public journals, with some user-specific information
 */
export const Library = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<'library', LibraryResources, LibraryMappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const isErrorVWC = useMappedValueWithCallbacks(resources.list, (list) => list === undefined);
  useValueWithCallbacksEffect(isErrorVWC, (isError) => {
    if (isError) {
      trace({
        type: 'error',
        listUndefined: resources.list.get() === undefined,
      });
    }
    return undefined;
  });

  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (size) => size.width);

  const gotoJourney = useCallback(
    (journey: SearchPublicJourney) => {
      configurableScreenOut(
        workingVWC,
        startPop,
        transition,
        screen.parameters.close.exit,
        screen.parameters.journeyTrigger,
        {
          parameters: {
            journey_uid: journey.uid,
          },
          afterDone: () => {
            trace({ type: 'journey', journey_uid: journey.uid, journey_title: journey.title });
            if (!journey.requiresPro) {
              trackClassTaken(ctx);
              return;
            }

            (async () => {
              const user = ctx.login.value.get();
              if (user.state !== 'logged-in') {
                return;
              }

              const req = ctx.resources.entitlementsHandler.request({
                ref: { user, entitlement: 'pro' },
                refreshRef: () => ({
                  promise: Promise.resolve({
                    type: 'expired',
                    error: <>Refresh not expected here</>,
                    data: undefined,
                    retryAt: undefined,
                  }),
                  cancel: () => {},
                  done: () => true,
                }),
              });
              const data = await waitForValuesWithCallbacksCondition(
                req.data,
                (d) => d.type !== 'loading'
              );
              if (data.type !== 'success') {
                req.release();
                return;
              }

              if (data.data.isActive) {
                trackClassTaken(ctx);
              }

              req.release();
            })();
          },
        }
      );
    },
    [screen.parameters, workingVWC, startPop, transition]
  );

  const boundComponent = useMemo<
    (
      item: ValueWithCallbacks<SearchPublicJourney | TooltipPlaceholder>,
      replaceItem: (item: SearchPublicJourney | TooltipPlaceholder) => void,
      previous: ValueWithCallbacks<SearchPublicJourney | TooltipPlaceholder | null>,
      next: ValueWithCallbacks<SearchPublicJourney | TooltipPlaceholder | null>
    ) => ReactElement
  >(() => {
    return (item, _replaceItem, _previous, next) => (
      <JourneyComponentWrapper
        gotoJourney={gotoJourney}
        item={item}
        ctx={ctx}
        screen={screen}
        next={next}
      />
    );
  }, [ctx, screen, gotoJourney]);

  const filterTagsVWC = useMappedValuesWithCallbacks(
    [resources.filter, resources.instructors],
    () => {
      const f = resources.filter.get();
      let result: ReactElement[] = [];
      if (f.favorites !== 'ignore') {
        result.push(
          f.favorites === 'only' ? (
            <>
              <HeartFilled
                icon={{
                  width: 24,
                }}
                container={{
                  width: 24,
                  height: 24,
                }}
                startPadding={{
                  x: {
                    fraction: 0.5,
                  },
                  y: {
                    fraction: 0.5,
                  },
                }}
                color={OsehColors.v4.other.green}
              />
              <HorizontalSpacer width={8} />
              <div className={styles.tagText}>Favorites</div>
            </>
          ) : (
            <div className={styles.tagText}>Not Favorites</div>
          )
        );
      }
      if (f.taken !== 'ignore') {
        result.push(
          f.taken === 'only' ? (
            <>
              <Check
                icon={{ width: 24 }}
                container={{ width: 24, height: 24 }}
                startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                color={OsehColors.v4.primary.light}
              />
              <HorizontalSpacer width={8} />
              <div className={styles.tagText}>Taken</div>
            </>
          ) : (
            <>
              <Close
                icon={{ width: 12 }}
                container={{ width: 12, height: 24 }}
                startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                color={OsehColors.v4.primary.light}
              />
              <HorizontalSpacer width={8} />
              <div className={styles.tagText}>Not Taken</div>
            </>
          )
        );
      }

      if (f.instructors.length > 0) {
        const instructors = resources.instructors.get();
        const instructorUidToInstructor = new Map<string, SearchPublicInstructor>();
        if (instructors !== null && instructors !== undefined) {
          for (const instructor of instructors) {
            instructorUidToInstructor.set(instructor.uid, instructor);
          }
        }

        for (const instructorUid of f.instructors) {
          const instructor = instructorUidToInstructor.get(instructorUid);
          if (instructor === undefined) {
            result.push(<div className={styles.tagText}>Failed to Load</div>);
          } else {
            result.push(
              <>
                {instructor.picture !== null && instructor.picture !== undefined && (
                  <>
                    <ScreenDynamicImage
                      ctx={ctx}
                      imgRef={instructor.picture}
                      width={24}
                      height={24}
                      borderRadius={12}
                    />
                    <HorizontalSpacer width={8} />
                  </>
                )}
                <div className={styles.tagText}>{instructor.name}</div>
              </>
            );
          }
        }
      }
      return result;
    }
  );

  const topToFilterHeightVWC = useWritableValueWithCallbacks<number>(() => 24);
  const filterButtonRowHeightVWC = useWritableValueWithCallbacks<number>(() => 50);
  const filterToTagsSpacingVWC = useMappedValueWithCallbacks(filterTagsVWC, (tags) =>
    tags.length === 0 ? 0 : 8
  );
  const tagsRowHeightVWC = useWritableValueWithCallbacks<number>(() =>
    filterTagsVWC.get().length === 0 ? 0 : 24 + 16
  );
  const tagsRowWidthVWC = useWritableValueWithCallbacks<number>(() => 0);
  useValueWithCallbacksEffect(filterTagsVWC, (tags) => {
    if (tags.length === 0) {
      setVWC(tagsRowHeightVWC, 0);
    }
    return undefined;
  });

  const filterToListSpacingVWC = useMappedValueWithCallbacks(
    filterTagsVWC,
    /* 8 is absorbed to make the horizontal region easier to scroll */
    (tags) => (tags.length === 0 ? 30 : 22)
  );
  const listToBottomSpacingVWC = useWritableValueWithCallbacks<number>(() => 0);

  const listHeight = useMappedValuesWithCallbacks(
    [
      ctx.windowSizeImmediate,
      topToFilterHeightVWC,
      filterButtonRowHeightVWC,
      filterToTagsSpacingVWC,
      tagsRowHeightVWC,
      filterToListSpacingVWC,
    ],
    () =>
      ctx.windowSizeImmediate.get().height -
      54 /* screen header */ -
      topToFilterHeightVWC.get() -
      filterButtonRowHeightVWC.get() -
      filterToTagsSpacingVWC.get() -
      tagsRowHeightVWC.get() -
      filterToListSpacingVWC.get() -
      listToBottomSpacingVWC.get() +
      10 /* we pull ourself up by negative margin to make it more clear when we're at the top, this compensates */
  );

  const mappedListVWC = useMappedValueWithCallbacks(
    resources.list,
    (list): InfiniteListing<SearchPublicJourney | TooltipPlaceholder> | null | undefined => {
      if (list === null) {
        return null;
      }

      if (list === undefined) {
        return undefined;
      }

      if (screen.parameters.tooltip === null) {
        return list as NetworkedInfiniteListing<SearchPublicJourney | TooltipPlaceholder>;
      }

      return new PrefixedNetworkedInfiniteListing<SearchPublicJourney, TooltipPlaceholder>(list, [
        { uid: 'tooltip' },
      ]) as any as NetworkedInfiniteListing<SearchPublicJourney | TooltipPlaceholder>;
    },
    {
      inputEqualityFn: () => false,
    }
  );

  const numFiltersVWC = useMappedValueWithCallbacks(resources.filter, (f) => {
    let result = 0;
    if (f.favorites !== 'ignore') {
      result++;
    }
    if (f.taken !== 'ignore') {
      result++;
    }
    result += f.instructors.length;
    return result;
  });

  const tagsSizesVWC = useMappedValuesWithCallbacks([ctx.contentWidth, windowWidthVWC], () => ({
    contentWidth: ctx.contentWidth.get(),
    windowWidth: windowWidthVWC.get(),
  }));
  const tagsHorizontalPaddingVWC = useMappedValuesWithCallbacks(
    [ctx.contentWidth, windowWidthVWC, tagsRowWidthVWC],
    () => {
      const contentWidth = ctx.contentWidth.get();
      const windowWidth = windowWidthVWC.get();
      const tagsRowWidth = tagsRowWidthVWC.get();

      if (tagsRowWidth <= contentWidth) {
        return 0;
      }

      if (tagsRowWidth + 96 < windowWidth) {
        return 0;
      }

      return (windowWidth - contentWidth) / 2;
    }
  );

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        gridSizeVWC={ctx.windowSizeImmediate}
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="flex-start">
        <ScreenHeader
          close={{
            variant: screen.parameters.close.variant,
            onClick: (e) => {
              e.preventDefault();
              configurableScreenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.close.exit,
                screen.parameters.close.trigger,
                {
                  afterDone: () => {
                    trace({ type: 'close' });
                  },
                }
              );
            },
          }}
          text={screen.parameters.header}
          windowWidth={windowWidthVWC}
          contentWidth={ctx.contentWidth}
        />
        <RenderGuardedComponent
          props={topToFilterHeightVWC}
          component={(h) => <VerticalSpacer height={h} />}
        />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <OnLayoutAdapter
            onLayout={(e) => {
              const height = e?.nativeEvent?.layout?.height;
              if (height !== undefined && height !== null && !isNaN(height) && height >= 0) {
                setVWC(filterButtonRowHeightVWC, height);
              }
            }}
            component={(filterButtonRowRef) => (
              <div className={styles.row} ref={(r) => setVWC(filterButtonRowRef, r)}>
                <RenderGuardedComponent
                  props={numFiltersVWC}
                  component={(numFilters) => (
                    <>
                      <button
                        type="button"
                        className={
                          numFilters === 0 ? styles.filterButton : styles.filterButtonActive
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          configurableScreenOut(
                            workingVWC,
                            startPop,
                            transition,
                            screen.parameters.close.exit,
                            screen.parameters.editFilterTrigger,
                            {
                              parameters: {
                                filter: convertLibraryFilterToAPI(resources.filter.get()),
                              },
                              afterDone: () => {
                                trace({ type: 'filter' });
                              },
                            }
                          );
                        }}>
                        <div className={styles.column}>
                          <VerticalSpacer height={12} />
                          <div className={styles.row}>
                            <HorizontalSpacer width={16} />
                            <div
                              className={
                                numFilters === 0
                                  ? styles.filterButtonText
                                  : styles.filterButtonActiveText
                              }>
                              Filter{numFilters === 0 ? '' : ` (${numFilters})`}
                            </div>
                            <Filter
                              icon={{
                                width: 16,
                              }}
                              container={{
                                width: 16 + (numFilters === 0 ? 7 : 12) + 16,
                                height: 24,
                              }}
                              startPadding={{
                                x: {
                                  fixed: numFilters === 0 ? 7 : 12,
                                },
                                y: {
                                  fraction: 0.5,
                                },
                              }}
                              color={
                                numFilters === 0
                                  ? OsehColors.v4.primary.light
                                  : OsehColors.v4.primary.dark
                              }
                            />
                          </div>
                          <VerticalSpacer height={12} />
                        </div>
                      </button>
                      {numFilters > 0 && (
                        <>
                          <HorizontalSpacer width={0} flexGrow={1} />
                          <button
                            type="button"
                            className={styles.clearFiltersButton}
                            onClick={(e) => {
                              e.preventDefault();
                              setVWC(resources.filter, {
                                favorites: 'ignore',
                                taken: 'ignore',
                                instructors: [],
                                __mapped: true,
                              });
                            }}>
                            <div className={styles.row}>
                              <Close
                                icon={{
                                  width: 20,
                                }}
                                container={{
                                  width: 24,
                                  height: 24,
                                }}
                                startPadding={{
                                  x: {
                                    fraction: 0.5,
                                  },
                                  y: {
                                    fraction: 0.5,
                                  },
                                }}
                                color={OsehColors.v4.primary.smoke}
                              />
                              <HorizontalSpacer width={4} />
                              <div className={styles.clearFiltersButtonText}>Clear Filters</div>
                            </div>
                          </button>
                        </>
                      )}
                    </>
                  )}
                />
              </div>
            )}
          />
        </ContentContainer>
        <RenderGuardedComponent
          props={filterToTagsSpacingVWC}
          component={(h) => <VerticalSpacer height={h} />}
        />
        <RenderGuardedComponent
          props={filterTagsVWC}
          component={(tags) => {
            if (tags.length === 0) {
              return <></>;
            }

            return (
              <OnLayoutAdapter
                onLayout={(e) => {
                  const height = e?.nativeEvent?.layout?.height;
                  if (height !== undefined && height !== null && !isNaN(height) && height >= 0) {
                    setVWC(tagsRowHeightVWC, height);
                  }
                  const width = e?.nativeEvent?.layout?.width;
                  if (width !== undefined && width !== null && !isNaN(width) && width >= 0) {
                    setVWC(tagsRowWidthVWC, width);
                  }
                }}
                opts={{ getSize: (e) => ({ width: e.scrollWidth, height: e.scrollHeight }) }}
                component={(tagsRowRef) => (
                  <RenderGuardedComponent
                    props={tagsSizesVWC}
                    component={({ contentWidth, windowWidth }) => (
                      <div
                        className={styles.tags}
                        style={{ minWidth: `${contentWidth}px`, maxWidth: `${windowWidth}px` }}
                        ref={(r) => setVWC(tagsRowRef, r)}>
                        {tags.map((tag, i) => (
                          <Fragment key={i}>
                            {i === 0 && (
                              <RenderGuardedComponent
                                props={tagsHorizontalPaddingVWC}
                                component={(p) => <HorizontalSpacer width={p} />}
                              />
                            )}
                            {i > 0 && (
                              <>
                                <HorizontalSpacer width={16} />
                                <div className={styles.column}>
                                  <VerticalSpacer height={8} />
                                  <div className={styles.tagSeparator} />
                                  <VerticalSpacer height={8} />
                                </div>
                                <HorizontalSpacer width={16} />
                              </>
                            )}
                            <div
                              className={styles.column}
                              style={{ flexShrink: 0, flexBasis: 'auto' }}>
                              <VerticalSpacer height={8} />
                              <div className={styles.tag}>{tag}</div>
                              <VerticalSpacer height={8} />
                            </div>
                            {i === tags.length - 1 && (
                              <RenderGuardedComponent
                                props={tagsHorizontalPaddingVWC}
                                component={(p) => <HorizontalSpacer width={p} />}
                              />
                            )}
                          </Fragment>
                        ))}
                      </div>
                    )}
                  />
                )}
              />
            );
          }}
        />
        <RenderGuardedComponent
          props={filterToListSpacingVWC}
          component={(h) => <VerticalSpacer height={h} />}
        />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks(
            [mappedListVWC, listHeight],
            () => ({
              list: mappedListVWC.get(),
              listHeight: listHeight.get(),
            }),
            {
              outputEqualityFn: (a, b) =>
                Object.is(a.list, b.list) && a.listHeight === b.listHeight,
            }
          )}
          component={({ list, listHeight }) =>
            list === null ? (
              <div className={styles.spinner}>
                <InlineOsehSpinner
                  size={{
                    type: 'react-rerender',
                    props: {
                      width: 60,
                    },
                  }}
                />
              </div>
            ) : list === undefined ? (
              <RenderGuardedComponent
                props={ctx.contentWidth}
                component={(cw) => (
                  <div className={styles.empty} style={{ width: `${cw}px` }}>
                    There was an error loading the list. Try again or contact support by emailing
                    hi@oseh.com
                  </div>
                )}
              />
            ) : (
              <InfiniteList
                listing={list}
                component={boundComponent}
                itemComparer={compareJourneys}
                height={listHeight}
                gap={10}
                initialComponentHeight={74.8}
                emptyElement={
                  <RenderGuardedComponent
                    props={ctx.contentWidth}
                    component={(cw) => (
                      <div className={styles.empty} style={{ maxWidth: `${cw}px` }}>
                        Your search did not return any results
                      </div>
                    )}
                  />
                }
                noScrollBar
              />
            )
          }
        />
        <VerticalSpacer height={0} flexGrow={1} />
      </GridContentContainer>
      {screen.parameters.cta !== null ? (
        <GridContentContainer
          gridSizeVWC={ctx.windowSizeImmediate}
          contentWidthVWC={windowWidthVWC}
          justifyContent="flex-start"
          noPointerEvents>
          <VerticalSpacer height={0} flexGrow={1} />
          <div className={styles.cta}>
            <Button
              type="button"
              variant="filled-white"
              onClick={(e) => {
                e.preventDefault();
                const cta = screen.parameters.cta;
                if (cta === null) {
                  return;
                }
                configurableScreenOut(workingVWC, startPop, transition, cta.exit, cta.trigger, {
                  afterDone: () => {
                    trace({ type: 'cta' });
                  },
                });
              }}>
              {screen.parameters.cta.text}
            </Button>
          </div>
          <VerticalSpacer height={32} />
        </GridContentContainer>
      ) : null}
    </GridFullscreenContainer>
  );
};

const compareJourneys = (
  a: SearchPublicJourney | TooltipPlaceholder,
  b: SearchPublicJourney | TooltipPlaceholder
): boolean => a.uid === b.uid;

const JourneyComponentWrapper = ({
  gotoJourney: gotoJourneyOuter,
  item: itemVWC,
  next: nextVWC,
  screen,
  ctx,
}: {
  gotoJourney: (journey: SearchPublicJourney) => void;
  item: ValueWithCallbacks<SearchPublicJourney | TooltipPlaceholder>;
  next: ValueWithCallbacks<SearchPublicJourney | TooltipPlaceholder | null>;
  screen: PeekedScreen<string, LibraryMappedParams>;
  ctx: ScreenContext;
}): ReactElement => {
  const isTooltipVWC = useMappedValueWithCallbacks(itemVWC, (item) => item.uid === 'tooltip');
  return (
    <>
      <RenderGuardedComponent
        props={isTooltipVWC}
        component={(isTooltip) =>
          isTooltip ? (
            <Tooltip ctx={ctx} screen={screen} />
          ) : (
            <JourneyComponent
              gotoJourney={gotoJourneyOuter}
              item={itemVWC as ValueWithCallbacks<SearchPublicJourney>}
              width={ctx.contentWidth}
            />
          )
        }
      />
      <RenderGuardedComponent
        props={nextVWC}
        component={(next) => (next === null ? <VerticalSpacer height={32} /> : <></>)}
      />
    </>
  );
};

const Tooltip = ({
  ctx,
  screen,
}: {
  ctx: ScreenContext;
  screen: PeekedScreen<string, LibraryMappedParams>;
}): ReactElement => {
  const tooltipRefVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const tooltipStyleVWC = useMappedValueWithCallbacks(ctx.contentWidth, (width) => ({
    width: `${width}px`,
  }));
  useStyleVWC(tooltipRefVWC, tooltipStyleVWC);
  return (
    <div className={styles.tooltipContainer}>
      <div
        className={styles.tooltip}
        style={tooltipStyleVWC.get()}
        ref={(r) => setVWC(tooltipRefVWC, r)}>
        <div className={styles.tooltipHeader}>
          {screen.parameters.tooltip?.header ?? 'Tooltip Header'}
        </div>
        <div style={{ height: '8px' }} />
        <div className={styles.tooltipBody}>
          {screen.parameters.tooltip?.body ?? 'Tooltip Body'}
        </div>
      </div>
    </div>
  );
};

const JourneyComponent = ({
  gotoJourney: gotoJourneyOuter,
  item: itemVWC,
  width: widthVWC,
}: {
  gotoJourney: (journey: SearchPublicJourney) => void;
  item: ValueWithCallbacks<SearchPublicJourney>;
  width: ValueWithCallbacks<number>;
}): ReactElement => {
  return (
    <LibraryCard
      onClick={useCallback(() => gotoJourneyOuter(itemVWC.get()), [itemVWC, gotoJourneyOuter])}
      item={itemVWC}
      width={widthVWC}
    />
  );
};
