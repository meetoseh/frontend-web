import { ReactElement, useContext, useRef, useState } from 'react';
import styles from './CourseAttachScreen.module.css';
import { OsehImage } from '../../shared/OsehImage';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { Button } from '../../shared/forms/Button';
import { useVisitor } from '../../shared/hooks/useVisitor';
import { SplashScreen } from '../splash/SplashScreen';
import { useSingletonEffect } from '../../shared/lib/useSingletonEffect';
import { LoginContext } from '../../shared/LoginContext';
import { ErrorBlock, describeError } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';

/**
 * The screen for associating a checkout, previously made by a guest, to a user.
 * This screen is shown shortly after the user purchases a course, after they've
 * logged in. The user always goes through the activation process prior to attachment
 * even if they land on the checkout success page already logged in.
 */
export const CourseAttachScreen = (): ReactElement => {
  useVisitor();
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReactElement | null>(null);

  const handled = useRef(false);
  useSingletonEffect(
    (onDone) => {
      if (handled.current) {
        onDone();
        return;
      }

      if (loginContext.state === 'loading') {
        onDone();
        return;
      }

      if (loginContext.state === 'logged-out') {
        onDone();
        window.location.href = '/';
        return;
      }

      let active = true;
      attachCourse();
      return () => {
        active = false;
      };

      async function attachCourseInner() {
        const activatedCourseRaw = localStorage.getItem('activated-course');
        const activatedCourse: { session: string; slug: string } | null =
          activatedCourseRaw === null ? null : JSON.parse(activatedCourseRaw);
        if (activatedCourse === null || typeof activatedCourse.session !== 'string') {
          setError(
            <div>
              The required information for attaching your course is not available. If you have
              already attached the course, simply continue to oseh.io - otherwise, please contact us
              at <a href="mailto:hi@oseh.com">hi@oseh.com</a>.
            </div>
          );
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
          const err = await describeError(e);
          if (active) {
            setError(err);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
          onDone();
        }
      }
    },
    [loginContext]
  );

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImage
          uid="oseh_if_hH68hcmVBYHanoivLMgstg"
          jwt={null}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          isPublic={true}
          placeholderColor="#01181e"
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer}>
          {error !== null ? (
            <div style={{ marginBottom: '40px' }}>
              <ErrorBlock>{error}</ErrorBlock>
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
                  <div className={styles.checkmarkContainer} />
                  <div className={styles.checkmarkText}>Start your first class</div>
                </div>
                <div className={styles.checkmarkItem}>
                  <div className={styles.checkmarkContainer} />
                  <div className={styles.checkmarkText}>Explore additional classes</div>
                </div>
                <div className={styles.checkmarkItem}>
                  <div className={styles.checkmarkContainer} />
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
