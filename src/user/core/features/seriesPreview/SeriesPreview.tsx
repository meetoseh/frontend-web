import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { SeriesPreviewResources } from './SeriesPreviewResources';
import { SeriesPreviewState } from './SeriesPreviewState';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { CoursePreview } from '../../../series/components/CoursePreview';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { setVWC } from '../../../../shared/lib/setVWC';

/**
 * The top-level component to show the series preview screen, which
 * lets users watch the intro preview video for a series, go back,
 * or go to the series details.
 */
export const SeriesPreview = ({
  state: stateVWC,
  resources: resourcesVWC,
}: FeatureComponentProps<SeriesPreviewState, SeriesPreviewResources>): ReactElement => {
  const courseVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.show?.course);
  const transition = useTransitionProp((): StandardScreenTransition => {
    const enter = stateVWC.get().show?.enter;
    if (enter === 'wipe-up') {
      return { type: 'wipe', direction: 'up', ms: 350 };
    }
    if (enter === 'wipe-down') {
      return { type: 'wipe', direction: 'down', ms: 350 };
    }
    return {
      type: 'fade',
      ms: 500,
    };
  });
  useEntranceTransition(transition);

  return (
    <RenderGuardedComponent
      props={courseVWC}
      component={(course) => {
        if (course === null || course === undefined) {
          return <></>;
        }
        return (
          <CoursePreview
            course={course}
            onViewDetails={async () => {
              setVWC(transition.animation, {
                type: 'wipe',
                direction: 'up',
                ms: 350,
              });
              await playExitTransition(transition).promise;
              resourcesVWC.get().gotoDetails(course);
            }}
            onBack={async () => {
              setVWC(transition.animation, { type: 'fade', ms: 350 });
              await playExitTransition(transition).promise;
              resourcesVWC.get().goBack();
            }}
            imageHandler={resourcesVWC.get().imageHandler}
            transition={transition}
          />
        );
      }}
    />
  );
};
