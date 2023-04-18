import { ReactElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  StoredVisitor,
  getUTMFromURL,
  loadVisitorFromStore,
  writeVisitorToStore,
} from '../../shared/hooks/useVisitor';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/LoginContext';
import { useTimezone } from '../../shared/hooks/useTimezone';
import { Course, courseKeyMap } from './models/Course';
import { useSingletonEffect } from '../../shared/lib/useSingletonEffect';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import styles from './CourseActivateScreen.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import {
  OsehImage,
  OsehImageFromState,
  OsehImageProps,
  useOsehImageState,
} from '../../shared/OsehImage';
import { SocialSignins, useProviderUrls, useRedirectUrl } from '../login/LoginApp';
import { Button } from '../../shared/forms/Button';
import { CourseAttachScreen } from './CourseAttachScreen';

/**
 * The activation screen for a course, which should be the first screen
 * after a user checks out. Two query parameters should be available:
 * slug, for the slug of the course, and session, for the stripe checkout
 * session id.
 *
 * A reasonable amount of effort goes into ensuring that visitor information
 * can be tracked without waterfalling the critical path.
 */
export const CourseActivateScreen = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [visitor, setVisitor] = useState<StoredVisitor | null>(() => loadVisitorFromStore());
  const timezone = useTimezone();
  const utm = useMemo(() => {
    return getUTMFromURL();
  }, []);
  const slug = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  }, []);
  const session = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
  }, []);
  const [course, setCourse] = useState<Course | null>(null);

  const associatedUTMWithVisitorUID = useRef<string | null>(null);
  useRedirectUrl('/courses/attach');
  useEffect(() => {
    if (slug !== null && session !== null) {
      localStorage.setItem('activated-course', JSON.stringify({ slug, session }));
    }
  }, [slug, session]);

  useSingletonEffect(
    (onDone) => {
      if (
        utm === null ||
        visitor === null ||
        loginContext.state === 'loading' ||
        (associatedUTMWithVisitorUID.current !== null &&
          associatedUTMWithVisitorUID.current === visitor.uid)
      ) {
        onDone();
        return;
      }
      const currentUserSub =
        loginContext.state === 'logged-in' ? loginContext.userAttributes?.sub ?? null : null;

      let active = true;
      doAssociateUTM();
      return () => {
        active = false;
      };

      async function doAssociateUTMInner() {
        if (utm === null) {
          return;
        }

        const response = await apiFetch(
          '/api/1/visitors/utms?source=browser',
          {
            method: 'POST',
            headers: Object.assign(
              (visitor === null ? {} : { Visitor: visitor.uid }) as {
                [key: string]: string;
              },
              {
                'Content-Type': 'application/json; charset=utf-8',
              } as { [key: string]: string }
            ),
            body: JSON.stringify({
              utm_source: utm.source,
              utm_medium: utm.medium,
              utm_campaign: utm.campaign,
              utm_content: utm.content,
              utm_term: utm.term,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const newVisitor = {
          uid: data.uid,
          user: currentUserSub === null ? null : { sub: currentUserSub, time: Date.now() },
        };
        writeVisitorToStore(newVisitor);
        associatedUTMWithVisitorUID.current = newVisitor.uid;
        if (active) {
          setVisitor((v) => {
            if (v !== null && v.uid === newVisitor.uid && v.user === newVisitor.user) {
              return v;
            }
            return newVisitor;
          });
        }
      }

      async function doAssociateUTM() {
        try {
          await doAssociateUTMInner();
        } catch (e) {
          console.error('error associating utm with visitor:', e);
        } finally {
          onDone();
        }
      }
    },
    [utm, visitor, loginContext]
  );

  useSingletonEffect(
    (onDone) => {
      let active = true;
      activateCourse();
      return () => {
        active = false;
      };

      async function activateCourseInner() {
        if (
          loginContext.state === 'loading' ||
          slug === null ||
          session === null ||
          !active ||
          course !== null
        ) {
          return;
        }

        const response = await apiFetch(
          '/api/1/courses/activate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...(visitor === null ? {} : { Visitor: visitor.uid }),
            },
            body: JSON.stringify({
              checkout_session_id: session,
              source: 'browser',
              timezone,
              timezone_technique: 'browser',
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: { course: any; visitor_uid: string } = await response.json();
        if (
          visitor === null ||
          visitor.uid !== data.visitor_uid ||
          visitor.user?.sub !== loginContext.userAttributes?.sub
        ) {
          setVisitor({
            uid: data.visitor_uid,
            user:
              loginContext.userAttributes?.sub === undefined
                ? null
                : { sub: loginContext.userAttributes?.sub, time: Date.now() },
          });
        }

        const newCourse = convertUsingKeymap(data.course, courseKeyMap);
        setCourse(newCourse);
      }

      async function activateCourse() {
        try {
          await activateCourseInner();
        } finally {
          onDone();
        }
      }
    },
    [slug, visitor, loginContext, course, timezone]
  );

  const windowSize = useWindowSize();
  const fullHeightStyle = useFullHeightStyle({ attribute: 'height', windowSize });
  const backgroundProps = useMemo<OsehImageProps>(() => {
    if (course === null) {
      return {
        uid: null,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        placeholderColor: '#121111',
      };
    }
    return {
      uid: course.backgroundImage.uid,
      jwt: course.backgroundImage.jwt,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      placeholderColor: '#121111',
    };
  }, [course, windowSize]);
  const background = useOsehImageState(backgroundProps);
  const urls = useProviderUrls(loginContext.state === 'logged-out');

  if (slug === null || session === null) {
    return (
      <div className={styles.container}>
        <div className={styles.imageContainer}>
          <OsehImage
            uid={
              windowSize.width < 450
                ? 'oseh_if_ds8R1NIo4ch3pD7vBRT2cg'
                : 'oseh_if_hH68hcmVBYHanoivLMgstg'
            }
            jwt={null}
            displayWidth={windowSize.width}
            displayHeight={windowSize.height}
            alt=""
            isPublic={true}
          />
        </div>
        <div className={styles.innerContainer}>
          <div
            className={styles.primaryContainer}
            style={windowSize.width < 450 ? fullHeightStyle : undefined}>
            <div className={styles.logoAndInfoContainer}>
              <div className={styles.logoContainer}>
                <div className={styles.logo} />
                <div className={assistiveStyles.srOnly}>Oseh</div>
              </div>
              <div className={styles.info}>
                You have landed on a course checkout page, but the url is missing some information.
                Please contact us at <strong>hi@oseh.com</strong> soon as possible so we can help
                you get started.
              </div>
            </div>
            <div className={styles.socialSigninsContainer}>
              <Button type="button" variant="filled" onClick="mailto:hi@oseh.com" fullWidth>
                Contact Us
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (course === null || background.loading || loginContext.state === 'loading') {
    return <SplashScreen type="wordmark" />;
  }

  if (loginContext.state === 'logged-out') {
    if (urls === null) {
      return <SplashScreen type="wordmark" />;
    }

    return (
      <div className={styles.container}>
        <div className={styles.imageContainer}>
          <OsehImageFromState {...background} />
        </div>
        <div className={styles.innerContainer}>
          <div
            className={styles.primaryContainer}
            style={windowSize.width < 450 ? fullHeightStyle : undefined}>
            <div className={styles.logoAndInfoContainer}>
              <div className={styles.logoContainer}>
                <div className={styles.logo} />
                <div className={assistiveStyles.srOnly}>Oseh</div>
              </div>
              <div className={styles.info}>
                Hive-five on your {course.title}. Login below to continue building a mindfulness
                habit.
              </div>
            </div>
            <div className={styles.socialSigninsContainer}>
              <SocialSignins urls={urls} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <CourseAttachScreen />;
};
