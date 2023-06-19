import { ReactElement, useCallback, useState } from 'react';
import { CourseClassesState } from './CourseClassesState';
import { CourseClassesResources } from './CourseClassesResources';
import { FeatureComponentProps } from '../../models/Feature';
import { Course } from '../../../courses/models/Course';
import { Journey } from '../../../journey/screens/Journey';
import styles from './CourseClasses.module.css';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { Button } from '../../../../shared/forms/Button';
import { JourneyRef } from '../../../journey/models/JourneyRef';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';

/**
 * The main component for rendering course classes. Course classes are
 * displayed with a custom start screen followd directly by the journey.
 * The prompt and ratings screens are omitted.
 */
export const CourseClasses = ({
  state,
  resources,
}: FeatureComponentProps<CourseClassesState, CourseClassesResources>): ReactElement => {
  const [step, setStep] = useState<'start' | 'journey'>('start');

  const skipJourney = useCallback(() => {}, []);

  const gotoJourney = useCallback(() => {
    resources.journeyShared?.audio?.play?.call(undefined);
    setStep('journey');
  }, [resources.journeyShared?.audio?.play]);

  const finishJourney = useCallback(() => {
    if (state.course === null || state.course === undefined || resources.journey === null) {
      console.warn('finishJourney called but course or journey not loaded');
      return;
    }

    state.onDone.call(undefined, state.course, resources.journey);
  }, [state.onDone, state.course, resources.journey]);

  if (
    state.course === null ||
    state.course === undefined ||
    resources.loading ||
    resources.journey === null ||
    resources.journeyShared === null ||
    resources.startBackground === null
  ) {
    return (
      <>
        This screen should not be visible. ERR_COURSE_NOT_LOADED. resources.loading?{' '}
        {(resources.loading && 'yes') || 'no'}
      </>
    );
  }

  if (step === 'start') {
    return (
      <CourseClassStartScreen
        course={state.course}
        journey={resources.journey}
        circle={resources.courseCircle}
        background={resources.startBackground}
        onSkip={skipJourney}
        onContinue={gotoJourney}
      />
    );
    // return (
    //   <JourneyStart
    //     journey={resources.journey}
    //     shared={resources.journeyShared}
    //     setScreen={finishJourney}
    //     onJourneyFinished={finishJourney}
    //     isOnboarding={true}
    //   />
    // );
  }

  return (
    <Journey
      journey={resources.journey}
      shared={resources.journeyShared}
      setScreen={finishJourney}
      onJourneyFinished={finishJourney}
      isOnboarding={false}
    />
  );
};

const CourseClassStartScreen = ({
  course,
  journey,
  circle,
  background,
  onSkip,
  onContinue,
}: {
  course: Course;
  journey: JourneyRef;
  circle: OsehImageState;
  background: OsehImageState;
  onSkip: () => void;
  onContinue: () => void;
}): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onSkip}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>
        <div className={styles.primaryContainer}>
          {circle !== null && (
            <div className={styles.circleContainer}>
              <OsehImageFromState {...circle} />
            </div>
          )}
          <div className={styles.title}>
            Ready to start {journey.title} with {journey.instructor.name}?
          </div>

          <Button type="button" variant="filled" onClick={onContinue} fullWidth>
            Let&rsquo;s Go
          </Button>
        </div>
      </div>
    </div>
  );
};
