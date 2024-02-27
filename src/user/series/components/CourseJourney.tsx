import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { OsehImageProps } from '../../../shared/images/OsehImageProps';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { Callbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { formatDurationClock } from '../../../shared/lib/networkResponseUtils';
import { setVWC } from '../../../shared/lib/setVWC';
import { MinimalCourseJourney } from '../../favorites/lib/MinimalCourseJourney';
import styles from './CourseJourney.module.css';

const DESIRED_HEIGHT = 76;

export const CourseJourney = ({
  association,
  index,
  imageHandler,
}: {
  association: MinimalCourseJourney;
  index: number;
  imageHandler: OsehImageStateRequestHandler;
}) => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const realHeight = useWritableValueWithCallbacks<number>(() => DESIRED_HEIGHT);
  const foregroundRef = useWritableValueWithCallbacks<HTMLElement | null>(() => null);

  useValueWithCallbacksEffect(foregroundRef, (foregroundRaw) => {
    if (foregroundRaw === null) {
      return undefined;
    }

    const cancelers = new Callbacks<undefined>();
    const foreground = foregroundRaw;

    if (window.ResizeObserver) {
      const observer = new ResizeObserver((entries) => {
        recheckHeight();
      });
      observer.observe(foreground);
      cancelers.add(() => observer.disconnect());
    } else {
      window.addEventListener('resize', recheckHeight);
      cancelers.add(() => window.removeEventListener('resize', recheckHeight));
    }

    return () => {
      cancelers.call(undefined);
    };

    function recheckHeight() {
      setVWC(
        realHeight,
        Math.max(foreground.scrollHeight, DESIRED_HEIGHT),
        (a, b) => Math.floor(a * devicePixelRatio) === Math.floor(b * devicePixelRatio)
      );
    }
  });

  const backgroundProps = useMappedValuesWithCallbacks(
    [realHeight, windowSizeVWC],
    (): OsehImageProps => ({
      uid: association.journey.darkenedBackground.uid,
      jwt: association.journey.darkenedBackground.jwt,
      displayWidth: Math.min(342, windowSizeVWC.get().width - 48),
      displayHeight: realHeight.get(),
      alt: '',
      placeholderColor: '#333333',
    })
  );
  const backgroundImage = useOsehImageStateValueWithCallbacks(
    { type: 'callbacks', props: backgroundProps.get, callbacks: backgroundProps.callbacks },
    imageHandler
  );

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <OsehImageFromStateValueWithCallbacks state={backgroundImage} />
      </div>
      <div className={styles.foreground}>
        <div className={styles.foregroundInner} ref={(v) => setVWC(foregroundRef, v, Object.is)}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              {association.journey.lastTakenAt !== null && <div className={styles.iconCheck} />}
              <div className={styles.index}>{(index + 1).toLocaleString()}</div>
              <div className={styles.title}>{association.journey.title}</div>
            </div>
            <div className={styles.headerRight}>
              {association.journey.lastTakenAt !== null && (
                <div className={styles.played}>Played</div>
              )}
              <div className={styles.duration}>
                {formatDurationClock(association.journey.durationSeconds, {
                  minutes: true,
                  seconds: true,
                  milliseconds: false,
                })}
              </div>
            </div>
          </div>
          <div className={styles.description}>{association.journey.description}</div>
        </div>
      </div>
    </div>
  );
};
