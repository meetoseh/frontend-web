import { ReactElement, useCallback, useContext, useRef, useState } from 'react';
import styles from './CourseAttachScreen.module.css';
import { OsehImage } from '../../shared/images/OsehImage';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { Button } from '../../shared/forms/Button';
import { SplashScreen } from '../splash/SplashScreen';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { BoxError, DisplayableError } from '../../shared/lib/errors';

/**
 * The screen for associating a checkout, previously made by a guest, to a user.
 * This screen is shown shortly after the user purchases a course, after they've
 * logged in. The user always goes through the activation process prior to attachment
 * even if they land on the checkout success page already logged in.
 */
export const CourseAttachScreen = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const windowSize = useWindowSize();
  const imageHandler = useOsehImageStateRequestHandler({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayableError | null>(null);

  const handled = useRef(false);
  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback((loginContextUnch) => {
      if (handled.current) {
        return;
      }

      if (loginContextUnch.state === 'loading') {
        return;
      }

      if (loginContextUnch.state === 'logged-out') {
        window.location.assign(window.location.origin);
        return;
      }
      const loginContext = loginContextUnch;

      let active = true;
      attachCourse();
      return () => {
        active = false;
      };

      async function attachCourseInner() {
        handled.current = true;
        const activatedCourseRaw = localStorage.getItem('activated-course');
        const activatedCourse: { session: string; slug: string } | null =
          activatedCourseRaw === null ? null : JSON.parse(activatedCourseRaw);
        if (activatedCourse === null || typeof activatedCourse.session !== 'string') {
          setError(new DisplayableError('client', 'attach course', 'information missing'));
          return;
        }

        const response = await apiFetch(
          '/api/1/courses/attach',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              checkout_session_id: activatedCourse.session,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        localStorage.removeItem('activated-course');
      }

      async function attachCourse() {
        setError(null);
        try {
          await attachCourseInner();
        } catch (e) {
          console.log('Error attaching the course to the user: ', e);
          const err =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'attach course', `${e}`);
          if (active) {
            setError(err);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
    }, [])
  );

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImage
          uid="oseh_if_NOA1u2xYanYQlA8rdpPEQQ"
          jwt={null}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          isPublic={true}
          placeholderColor="#040b17"
          handler={imageHandler}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer}>
          {error !== null ? (
            <div style={{ marginBottom: '40px' }}>
              <BoxError error={error} />
            </div>
          ) : (
            <>
              <div className={styles.title}>What&rsquo;s on the agenda?</div>
              <div className={styles.checkmarkList}>
                <div className={styles.checkmarkItem}>
                  <div className={styles.checkmarkContainer}>
                    <div className={styles.checkmark}></div>
                  </div>
                  <div className={styles.checkmarkText}>Signup for daily reminders</div>
                </div>
                <div className={styles.checkmarkItem}>
                  <div className={styles.checkmarkContainer}>
                    <div className={styles.checkmark2}></div>
                  </div>
                  <div className={styles.checkmarkText}>Start your first class</div>
                </div>
                <div className={styles.checkmarkItem}>
                  <div className={styles.checkmarkContainer}>
                    <div className={styles.checkmark3}></div>
                  </div>
                  <div className={styles.checkmarkText}>Explore additional classes</div>
                </div>
                <div className={styles.checkmarkItem}>
                  <div className={styles.checkmarkContainer}>
                    <div className={styles.checkmark4}></div>
                  </div>
                  <div className={styles.checkmarkText}>Build a daily mindfulness habit</div>
                </div>
              </div>
            </>
          )}
          <Button type="button" variant="filled" onClick="/" fullWidth>
            {error === null ? <>Let&rsquo;s Go</> : <>Back to Safety</>}
          </Button>
        </div>
      </div>
    </div>
  );
};
