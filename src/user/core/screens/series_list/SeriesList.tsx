import { CSSProperties, ReactElement, useCallback, useMemo } from 'react';
import { PeekedScreen, ScreenComponentProps } from '../../models/Screen';
import { SeriesListMappedParams } from './SeriesListParams';
import { SeriesListResources } from './SeriesListResources';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { ExternalCourse } from '../../../series/lib/ExternalCourse';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useRefreshedExternalCourse } from '../../../series/hooks/useRefreshedExternalCourse';
import { CourseCoverItem } from '../../../series/components/CourseCoverItem';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { InfiniteList } from '../../../../shared/components/InfiniteList';
import styles from './SeriesList.module.css';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
  PrefixedNetworkedInfiniteListing,
} from '../../../../shared/lib/InfiniteListing';
import { ScreenContext } from '../../hooks/useScreenContext';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Button } from '../../../../shared/forms/Button';
import { largestPhysicalPerLogical } from '../../../../shared/images/DisplayRatioHelper';

type TooltipPlaceholder = { readonly uid: 'tooltip' };

/**
 * Displays the series listing page with an optional tooltip and
 * call to action.
 */
export const SeriesList = ({
  ctx,
  screen,
  resources,
  startPop,
}: ScreenComponentProps<
  'series_list',
  SeriesListResources,
  SeriesListMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const showCourse = useCallback(
    async (course: ExternalCourse) => {
      if (workingVWC.get()) {
        return;
      }

      setVWC(workingVWC, true);
      const finishPop =
        screen.parameters.seriesTrigger === null
          ? startPop(null)
          : startPop(
              {
                slug: screen.parameters.seriesTrigger,
                parameters: {
                  series: { uid: course.uid, jwt: course.jwt },
                },
              },
              '/api/1/users/me/screens/pop_to_series'
            );
      setVWC(transition.animation, screen.parameters.exit);
      await playExitTransition(transition).promise;
      finishPop();
    },
    [workingVWC, screen, transition, startPop]
  );

  const boundComponent = useMemo<
    (
      item: ValueWithCallbacks<ExternalCourse | TooltipPlaceholder>,
      setItem: (newItem: ExternalCourse | TooltipPlaceholder) => void
    ) => ReactElement
  >(() => {
    return (item, setItem) => (
      <CourseCoverItemComponent
        gotoCourse={showCourse}
        item={item}
        setItem={setItem}
        replaceItem={(isItem, newItem) => {
          resources.list.get()?.replaceItem(isItem, newItem);
        }}
        imageHandler={resources.imageHandler}
        ctx={ctx}
        screen={screen}
      />
    );
  }, [showCourse, resources.imageHandler, resources.list, ctx, screen]);

  const listHeight = useMappedValueWithCallbacks(
    ctx.windowSizeImmediate,
    (size) => size.height - 32
  );

  const mappedListVWC = useMappedValueWithCallbacks(
    resources.list,
    (list): InfiniteListing<ExternalCourse | TooltipPlaceholder> | null => {
      if (list === null) {
        return null;
      }

      if (screen.parameters.tooltip === null) {
        return list as NetworkedInfiniteListing<ExternalCourse | TooltipPlaceholder>;
      }

      return new PrefixedNetworkedInfiniteListing<ExternalCourse, TooltipPlaceholder>(list, [
        { uid: 'tooltip' },
      ]) as any as NetworkedInfiniteListing<ExternalCourse | TooltipPlaceholder>;
    },
    {
      inputEqualityFn: () => false,
    }
  );

  const ctaStyleVWC = useMappedValuesWithCallbacks(
    [transitionState.left, transitionState.opacity],
    (): CSSProperties => ({
      position:
        Math.abs(transitionState.left.get() * largestPhysicalPerLogical) < 1
          ? 'static'
          : 'relative',
      left: `${transitionState.left.get()}px`,
      opacity: `${transitionState.opacity.get()}`,
    })
  );
  const ctaRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(ctaRef, ctaStyleVWC);

  const ctaInnerStyleVWC = useMappedValueWithCallbacks(
    ctx.contentWidth,
    (size) => ({
      width: `${size}px`,
    }),
    {
      inputEqualityFn: () => false,
    }
  );
  const ctaInnerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(ctaInnerRef, ctaInnerStyleVWC);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={useMappedValueWithCallbacks(ctx.windowSizeImmediate, (s) => s.width)}
        left={transitionState.left}
        opacity={transitionState.opacity}>
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks(
            [mappedListVWC, listHeight, resources.imageHeight],
            () => ({
              list: mappedListVWC.get(),
              listHeight: listHeight.get(),
              initialComponentHeight: resources.imageHeight.get(),
            }),
            {
              outputEqualityFn: (a, b) =>
                Object.is(a.list, b.list) &&
                a.listHeight === b.listHeight &&
                a.initialComponentHeight === b.initialComponentHeight,
            }
          )}
          component={({ list, listHeight, initialComponentHeight }) =>
            list === null ? (
              <></>
            ) : (
              <InfiniteList
                listing={list}
                component={boundComponent}
                itemComparer={compareCourses}
                height={listHeight}
                gap={10}
                initialComponentHeight={initialComponentHeight}
                emptyElement={
                  <div className={styles.empty}>There are no series available right now.</div>
                }
                noScrollBar
              />
            )
          }
        />
      </GridContentContainer>
      {screen.parameters.cta !== null && (
        <div className={styles.cta} style={ctaStyleVWC.get()} ref={(r) => setVWC(ctaRef, r)}>
          <div
            className={styles.ctaInner}
            style={ctaInnerStyleVWC.get()}
            ref={(r) => setVWC(ctaInnerRef, r)}>
            <Button
              type="button"
              variant="filled-white"
              onClick={async (e) => {
                e.preventDefault();
                if (workingVWC.get()) {
                  return;
                }

                setVWC(workingVWC, true);
                const trigger = screen.parameters.cta?.trigger ?? null;
                const finishPop = startPop(
                  trigger === null
                    ? null
                    : {
                        slug: trigger,
                        parameters: {},
                      }
                );
                setVWC(transition.animation, screen.parameters.exit);
                await playExitTransition(transition).promise;
                finishPop();
              }}>
              {screen.parameters.cta.text}
            </Button>
          </div>
        </div>
      )}
    </GridFullscreenContainer>
  );
};

const compareCourses = (
  a: ExternalCourse | TooltipPlaceholder,
  b: ExternalCourse | TooltipPlaceholder
): boolean => a.uid === b.uid;

const CourseCoverItemComponent = ({
  gotoCourse: gotoCourseOuter,
  item: itemVWC,
  setItem,
  replaceItem,
  imageHandler,
  ctx,
  screen,
}: {
  gotoCourse: (course: ExternalCourse) => void;
  item: ValueWithCallbacks<ExternalCourse | TooltipPlaceholder>;
  setItem: (item: ExternalCourse) => void;
  replaceItem: (
    isItem: (i: ExternalCourse) => boolean,
    newItem: (oldItem: ExternalCourse) => ExternalCourse
  ) => void;
  imageHandler: OsehImageStateRequestHandler;
  ctx: ScreenContext;
  screen: PeekedScreen<'series_list', SeriesListMappedParams>;
}): ReactElement => {
  const isTooltipVWC = useMappedValueWithCallbacks(itemVWC, (item) => item.uid === 'tooltip');
  return (
    <RenderGuardedComponent
      props={isTooltipVWC}
      component={(isTooltip) =>
        isTooltip ? (
          <Tooltip ctx={ctx} screen={screen} />
        ) : (
          <CourseCoverItemComponentInner
            item={itemVWC as ValueWithCallbacks<ExternalCourse>}
            setItem={setItem}
            replaceItem={replaceItem}
            gotoCourse={gotoCourseOuter}
            imageHandler={imageHandler}
          />
        )
      }
    />
  );
};

const Tooltip = ({
  ctx,
  screen,
}: {
  ctx: ScreenContext;
  screen: PeekedScreen<'series_list', SeriesListMappedParams>;
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

const CourseCoverItemComponentInner = ({
  gotoCourse: gotoCourseOuter,
  item: itemVWC,
  setItem,
  replaceItem,
  imageHandler,
}: {
  gotoCourse: (course: ExternalCourse) => void;
  item: ValueWithCallbacks<ExternalCourse>;
  setItem: (item: ExternalCourse) => void;
  replaceItem: (
    isItem: (i: ExternalCourse) => boolean,
    newItem: (oldItem: ExternalCourse) => ExternalCourse
  ) => void;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  useRefreshedExternalCourse(itemVWC, setItem, 'list');

  const gotoCourse = useCallback(() => {
    gotoCourseOuter(itemVWC.get());
  }, [gotoCourseOuter, itemVWC]);

  const mapItems = useCallback(
    (fn: (item: ExternalCourse) => ExternalCourse) => {
      replaceItem(() => true, fn);
    },
    [replaceItem]
  );

  return (
    <CourseCoverItem
      item={itemVWC}
      setItem={setItem}
      mapItems={mapItems}
      onClick={gotoCourse}
      imageHandler={imageHandler}
    />
  );
};
