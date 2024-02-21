import { useCallback } from 'react';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { Course } from './Course';
import { OsehImageProps } from '../../shared/images/OsehImageProps';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { useOsehImageStateValueWithCallbacks } from '../../shared/images/useOsehImageStateValueWithCallbacks';
import styles from './CourseBlock.module.css';
import buttonStyles from '../../shared/buttons.module.css';
import { OsehImageFromStateValueWithCallbacks } from '../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { OsehImageFromState } from '../../shared/images/OsehImageFromState';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { useListItemExpandModal } from '../lib/useListItemExpandModal';
import { CourseDetails } from './CourseDetails';

type CourseBlockProps = {
  /**
   * The course to display
   */
  course: Course;

  /**
   * Used to update the course after a confirmation from the server
   */
  setCourse: (this: void, course: Course) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Renders an admin course as it should be shown in a listing
 */
export const CourseBlock = ({ course, setCourse, imageHandler }: CourseBlockProps) => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const backgroundImageProps = useMappedValueWithCallbacks(
    windowSizeVWC,
    useCallback(
      (windowSize): OsehImageProps => {
        const ref = course.backgroundDarkenedImage ?? course.backgroundOriginalImage;

        const displayWidth = Math.min(342, windowSize.width - 24);
        const displayHeight = Math.round(displayWidth * (427 / 342));

        return {
          uid: ref?.uid ?? null,
          jwt: ref?.jwt ?? null,
          displayWidth,
          displayHeight,
          alt: '',
          placeholderColor: '#232323',
        };
      },
      [course]
    )
  );
  const logoImageProps = useMappedValuesWithCallbacks(
    [backgroundImageProps, windowSizeVWC],
    (): OsehImageProps => {
      const bkndProps = backgroundImageProps.get();
      const windowSize = windowSizeVWC.get();
      const targetWidth = (bkndProps.displayWidth ?? Math.min(342, windowSize.width - 24)) - 32;

      return {
        uid: course.logoImage?.uid ?? null,
        jwt: course.logoImage?.jwt ?? null,
        displayWidth: targetWidth,
        displayHeight: null,
        compareAspectRatio: (a, b) => b.width / b.height - a.width / a.height,
        alt: course.title,
      };
    }
  );

  const backgroundImage = useOsehImageStateValueWithCallbacks(
    {
      type: 'callbacks',
      props: backgroundImageProps.get,
      callbacks: backgroundImageProps.callbacks,
    },
    imageHandler
  );
  const logoImage = useOsehImageStateValueWithCallbacks(
    {
      type: 'callbacks',
      props: logoImageProps.get,
      callbacks: logoImageProps.callbacks,
    },
    imageHandler
  );

  const container = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([backgroundImage, container], () => {
    const ele = container.get();
    const state = backgroundImage.get();

    if (ele !== null) {
      ele.style.width = `${state.displayWidth}px`;
      ele.style.height = `${state.displayHeight}px`;
    }
    return undefined;
  });

  const expandedVWC = useListItemExpandModal(
    useCallback(
      (saveIfNecessary, editingVWC) => (
        <CourseDetails
          course={course}
          setCourse={setCourse}
          imageHandler={imageHandler}
          editingVWC={editingVWC}
          saveIfNecessary={saveIfNecessary}
        />
      ),
      [course, setCourse, imageHandler]
    )
  );

  return (
    <button
      type="button"
      className={buttonStyles.unstyled}
      onClick={(e) => {
        e.preventDefault();
        setVWC(expandedVWC, true);
      }}>
      <div className={styles.container} ref={(r) => setVWC(container, r, () => false)}>
        <div className={styles.background}>
          <OsehImageFromStateValueWithCallbacks state={backgroundImage} />
        </div>
        <div className={styles.content}>
          <div className={styles.logo}>
            <RenderGuardedComponent
              props={logoImage}
              component={(state) => {
                if (state.loading || state.localUrl === null) {
                  return <div className={styles.logoText}>{course.title}</div>;
                }

                return <OsehImageFromState {...state} />;
              }}
            />
          </div>
          <div className={styles.instructor}>{course.instructor.name}</div>
        </div>
      </div>
    </button>
  );
};
