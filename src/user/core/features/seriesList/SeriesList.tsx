import { CSSProperties, ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { SeriesListResources } from './SeriesListResources';
import { SeriesListState } from './SeriesListState';
import styles from './SeriesList.module.css';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import { CourseCoverItemsList } from '../../../series/components/CourseCoverItemsList';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { getPreviewableCourse } from '../../../series/lib/ExternalCourse';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../shared/lib/setVWC';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';

/**
 * The top-level component to show the series list screen, which
 * lets users browse the title cards for series and click to go
 * to the series details screen for that series.
 */
export const SeriesList = ({
  state: stateVWC,
  resources: resourcesVWC,
}: FeatureComponentProps<SeriesListState, SeriesListResources>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => {
    const forced = stateVWC.get().forced;
    if (forced !== null && forced.enter === 'swipe-left') {
      return { type: 'swipe', direction: 'to-right', ms: 350 };
    }
    if (forced !== null && forced.enter === 'swipe-right') {
      return { type: 'swipe', direction: 'to-left', ms: 350 };
    }
    return { type: 'fade', ms: 350 };
  });
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const listHeight = useMappedValueWithCallbacks(windowSizeVWC, (size) => size.height - 100);

  const foregroundRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const bottomNavRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const foregroundStyleVWC = useMappedValuesWithCallbacks(
    [transitionState.left, transitionState.opacity],
    (): CSSProperties => {
      const opacity = transitionState.opacity.get();
      const left = transitionState.left.get();
      return {
        left: `${left}px`,
        opacity: `${opacity}`,
      };
    }
  );
  useStyleVWC(foregroundRef, foregroundStyleVWC);
  useStyleVWC(bottomNavRef, foregroundStyleVWC);

  return (
    <div className={styles.container}>
      <FullHeightDiv className={styles.background} />
      <div
        className={styles.contentContainer}
        style={foregroundStyleVWC.get()}
        ref={(r) => setVWC(foregroundRef, r)}>
        <div className={styles.items}>
          <CourseCoverItemsList
            showCourse={async (course) => {
              if (course.hasEntitlement) {
                setVWC(transition.animation, {
                  type: 'wipe',
                  direction: 'up',
                  ms: 350,
                });
                await playExitTransition(transition).promise;
                resourcesVWC.get().gotoCourseDetails(course);
                return;
              }

              const previewable = getPreviewableCourse(course);
              if (previewable !== null) {
                setVWC(transition.animation, { type: 'fade', ms: 350 });
                await playExitTransition(transition).promise;
                resourcesVWC.get().gotoCoursePreview(previewable);
              }
            }}
            listHeight={listHeight}
            imageHandler={resourcesVWC.get().imageHandler}
          />
        </div>
      </div>
      <div
        className={styles.bottomNav}
        style={foregroundStyleVWC.get()}
        ref={(r) => setVWC(bottomNavRef, r)}>
        <BottomNavBar
          active="series"
          clickHandlers={{
            home: () => stateVWC.get().setForced(null, true),
            account: () => resourcesVWC.get().gotoSettings(),
          }}
        />
      </div>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </div>
  );
};
