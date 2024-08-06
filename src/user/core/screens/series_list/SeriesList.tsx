import { CSSProperties, ReactElement, useCallback, useMemo } from 'react';
import { PeekedScreen, ScreenComponentProps } from '../../models/Screen';
import { SeriesListMappedParams } from './SeriesListParams';
import { SeriesListResources } from './SeriesListResources';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
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
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import {
  GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT,
  GridSimpleNavigationForeground,
} from '../../../../shared/components/GridSimpleNavigationForeground';
import { screenOut } from '../../lib/screenOut';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

type TooltipPlaceholder = { readonly uid: 'tooltip' };

/**
 * Displays the series listing page with an optional tooltip and
 * call to action.
 */
export const SeriesList = ({
  ctx,
  screen,
  resources,
  trace,
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
      configurableScreenOut(
        workingVWC,
        startPop,
        transition,
        screen.parameters.exit,
        screen.parameters.seriesTrigger,
        {
          endpoint: '/api/1/users/me/screens/pop_to_series',
          parameters: {
            series: { uid: course.uid, jwt: course.jwt },
          },
          beforeDone: async () => {
            trace({
              type: 'click',
              target: 'course',
              course: { uid: course.uid, title: course.title },
            });
          },
        }
      );
    },
    [workingVWC, screen, transition, startPop, trace]
  );

  const size = useMappedValuesWithCallbacks([ctx.contentWidth, resources.imageHeight], () => ({
    width: ctx.contentWidth.get(),
    height: resources.imageHeight.get(),
  }));

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
        size={size}
      />
    );
  }, [showCourse, resources.imageHandler, resources.list, ctx, screen, size]);

  const listHeight = useMappedValueWithCallbacks(
    ctx.windowSizeImmediate,
    (size) =>
      size.height -
      32 -
      (screen.parameters.bottom ? GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT : 0)
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
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}>
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
        {screen.parameters.bottom && (
          <VerticalSpacer height={GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT} />
        )}
      </GridContentContainer>
      {screen.parameters.bottom && (
        <GridSimpleNavigationForeground
          workingVWC={workingVWC}
          startPop={startPop}
          gridSize={ctx.windowSizeImmediate}
          transitionState={transitionState}
          transition={transition}
          trace={trace}
          home={screen.parameters.bottom.home}
          series={null}
          account={screen.parameters.bottom.account}
          noTop
        />
      )}
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
                const cta = screen.parameters.cta;
                if (cta === null) {
                  return;
                }

                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.exit,
                  cta.trigger,
                  {
                    beforeDone: async () => {
                      trace({ type: 'click', target: 'cta' });
                    },
                  }
                );
              }}>
              {screen.parameters.cta.text}
            </Button>
            <VerticalSpacer height={32} />
            {screen.parameters.bottom && (
              <VerticalSpacer height={GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT} />
            )}
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
  size,
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
  screen: PeekedScreen<string, SeriesListMappedParams>;
  size: ValueWithCallbacks<{ width: number; height: number }>;
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
            size={size}
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
  screen: PeekedScreen<string, SeriesListMappedParams>;
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
  size,
}: {
  gotoCourse: (course: ExternalCourse) => void;
  item: ValueWithCallbacks<ExternalCourse>;
  setItem: (item: ExternalCourse) => void;
  replaceItem: (
    isItem: (i: ExternalCourse) => boolean,
    newItem: (oldItem: ExternalCourse) => ExternalCourse
  ) => void;
  imageHandler: OsehImageStateRequestHandler;
  size: ValueWithCallbacks<{ width: number; height: number }>;
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
      size={size}
    />
  );
};
