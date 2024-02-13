import { Journey } from './Journey';
import styles from './CompactJourney.module.css';
import { OsehImage } from '../../shared/images/OsehImage';
import { ReactElement, useContext, useCallback } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { Callbacks, useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { combineClasses } from '../../shared/lib/combineClasses';
import { formatDurationClock } from '../../shared/lib/networkResponseUtils';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageProps } from '../../shared/images/OsehImageProps';
import { useOsehImageStateValueWithCallbacks } from '../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../shared/images/OsehImageFromStateValueWithCallbacks';

type CompactJourneyProps = {
  /**
   * The journey to show
   */
  journey: Journey;

  /**
   * If set to true, this component will fetch and include how many views the journey
   * has
   */
  showViews?: boolean;

  /**
   * If set to true, this component will fetch and include the feedback for this journey
   */
  showFeedback?: boolean;

  /**
   * The handler for fetching images
   */
  imageHandler: OsehImageStateRequestHandler;
};

type FeedbackItem = {
  loved: number;
  liked: number;
  disliked: number;
  hated: number;
};

type Feedback = {
  unique: FeedbackItem;
  total: FeedbackItem;
};

const DESIRED_HEIGHT = 76;

/**
 * Shows a journey in a very compact, non-block format. This typically renders as a single
 * line if given at least 250px of width, and is 90px tall in that case.
 */
export const CompactJourney = ({
  journey,
  showViews,
  showFeedback,
  imageHandler,
}: CompactJourneyProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const viewsVWC = useWritableValueWithCallbacks<{ journeyUid: string; count: number } | undefined>(
    () => undefined
  );
  const feedbackVWC = useWritableValueWithCallbacks<
    { journeyUid: string; feedback: Feedback } | undefined
  >(() => undefined);

  const realHeight = useWritableValueWithCallbacks<number>(() => DESIRED_HEIGHT);
  const foregroundRef = useWritableValueWithCallbacks<HTMLElement | null>(() => null);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        const views = viewsVWC.get();
        if (
          !showViews ||
          views?.journeyUid === journey.uid ||
          loginContextUnch.state !== 'logged-in'
        ) {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchViews();
        return () => {
          active = false;
        };

        async function fetchViews() {
          const response = await apiFetch(
            '/api/1/admin/journey_views?' +
              new URLSearchParams({ journey_uid: journey.uid }).toString(),
            {
              method: 'GET',
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          if (active) {
            setVWC(viewsVWC, {
              journeyUid: journey.uid,
              count: data.views,
            });
          }
        }
      },
      [journey.uid, showViews, viewsVWC]
    )
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        const feedback = feedbackVWC.get();
        if (
          !showFeedback ||
          feedback?.journeyUid === journey.uid ||
          loginContextUnch.state !== 'logged-in'
        ) {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchFeedback();
        return () => {
          active = false;
        };

        async function fetchFeedback() {
          const response = await apiFetch(
            '/api/1/admin/journey_feedback/' + journey.uid,
            {
              method: 'GET',
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          if (active) {
            setVWC(feedbackVWC, {
              journeyUid: journey.uid,
              feedback: data,
            });
          }
        }
      },
      [journey.uid, showFeedback, feedbackVWC]
    )
  );

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

  const backgroundProps = useMappedValueWithCallbacks(
    realHeight,
    (height): OsehImageProps => ({
      uid: journey.darkenedBackgroundImage.uid,
      jwt: journey.darkenedBackgroundImage.jwt,
      displayWidth: 342,
      displayHeight: height,
      alt: '',
      placeholderColor: '#333333',
    })
  );
  const backgroundImage = useOsehImageStateValueWithCallbacks(
    { type: 'callbacks', props: backgroundProps.get, callbacks: backgroundProps.callbacks },
    imageHandler
  );

  return (
    <div
      className={combineClasses(
        styles.container,
        journey.deletedAt !== null ? styles.deleted : undefined
      )}>
      <div className={styles.background}>
        <OsehImageFromStateValueWithCallbacks state={backgroundImage} />
      </div>
      <div className={styles.foreground}>
        <div className={styles.foregroundInner} ref={(v) => setVWC(foregroundRef, v, Object.is)}>
          <div className={styles.header}>
            <div className={styles.title}>{journey.title}</div>
            <div className={styles.headerRight}>
              {showViews && (
                <RenderGuardedComponent
                  props={viewsVWC}
                  component={(views) => (
                    <div className={styles.views}>
                      {views === undefined
                        ? '? views'
                        : `${views.count.toLocaleString()} view${views.count === 1 ? '' : 's'}`}
                    </div>
                  )}
                />
              )}
              <div className={styles.duration}>
                {formatDurationClock(journey.durationSeconds, {
                  minutes: true,
                  seconds: true,
                  milliseconds: false,
                })}
              </div>
            </div>
          </div>
          <div className={styles.subheader}>
            <div className={styles.instructor}>
              {journey.instructor.picture !== null && (
                <div className={styles.instructorImage}>
                  <OsehImage
                    uid={journey.instructor.picture.uid}
                    jwt={journey.instructor.picture.jwt}
                    displayWidth={20}
                    displayHeight={20}
                    alt=""
                    handler={imageHandler}
                  />
                </div>
              )}
              <div className={styles.instructorName}>{journey.instructor.name}</div>
            </div>
            {showFeedback && (
              <RenderGuardedComponent
                props={feedbackVWC}
                component={(feedback) => {
                  const feedbackStr: Record<keyof FeedbackItem, string> =
                    feedback === undefined || feedback.journeyUid !== journey.uid
                      ? {
                          loved: '?',
                          liked: '?',
                          disliked: '?',
                          hated: '?',
                        }
                      : {
                          loved: feedback.feedback.total.loved.toLocaleString(),
                          liked: feedback.feedback.total.liked.toLocaleString(),
                          disliked: feedback.feedback.total.disliked.toLocaleString(),
                          hated: feedback.feedback.total.hated.toLocaleString(),
                        };

                  return (
                    <div className={styles.feedback}>
                      <div className={styles.feedbackItem}>
                        <div className={styles.feedbackEmoji}>☹️</div>
                        <div className={styles.feedbackCount}>{feedbackStr.hated}</div>
                      </div>
                      <div className={styles.feedbackItem}>
                        <div className={styles.feedbackEmoji}>😕</div>
                        <div className={styles.feedbackCount}>{feedbackStr.disliked}</div>
                      </div>
                      <div className={styles.feedbackItem}>
                        <div className={styles.feedbackEmoji}>😌</div>
                        <div className={styles.feedbackCount}>{feedbackStr.liked}</div>
                      </div>
                      <div className={styles.feedbackItem}>
                        <div className={styles.feedbackEmoji}>😍</div>
                        <div className={styles.feedbackCount}>{feedbackStr.loved}</div>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
