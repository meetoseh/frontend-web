import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { SeriesPreviewResources } from './SeriesPreviewResources';
import { SeriesPreviewState } from './SeriesPreviewState';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { CoursePreview } from '../../../series/components/CoursePreview';

/**
 * The top-level component to show the series preview screen, which
 * lets users watch the intro preview video for a series, go back,
 * or go to the series details.
 */
export const SeriesPreview = ({
  state: stateVWC,
  resources: resourcesVWC,
}: FeatureComponentProps<SeriesPreviewState, SeriesPreviewResources>): ReactElement => {
  const courseVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.show);

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
            onViewDetails={() => {
              resourcesVWC.get().gotoDetails(course);
            }}
            onBack={() => stateVWC.get().setShow(null, true)}
            imageHandler={resourcesVWC.get().imageHandler}
          />
        );
      }}
    />
  );
};
