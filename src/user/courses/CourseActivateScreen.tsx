import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  StoredVisitor,
  getUTMFromURL,
  loadVisitorFromStore,
  writeVisitorToStore,
} from '../../shared/hooks/useVisitor';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { useTimezone } from '../../shared/hooks/useTimezone';
import { Course, courseKeyMap } from './models/Course';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import styles from './CourseActivateScreen.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { Button } from '../../shared/forms/Button';
import { CourseAttachScreen } from './CourseAttachScreen';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { OsehImage } from '../../shared/images/OsehImage';
import { useOsehImageStateValueWithCallbacks } from '../../shared/images/useOsehImageStateValueWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { OsehImageFromStateValueWithCallbacks } from '../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../shared/images/useStaleOsehImageOnSwap';
import { OauthProvider } from '../login/lib/OauthProvider';
import { useOauthProviderUrlsValueWithCallbacks } from '../login/hooks/useOauthProviderUrlsValueWithCallbacks';
import { ProvidersList } from '../core/features/login/components/ProvidersList';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { setLoginRedirect } from '../login/lib/LoginRedirectStore';

/**
 * The activation screen for a course, which should be the first screen after a
 * user checks out. Two query parameters should be available: slug, for the slug
 * of the course, and session, for the stripe checkout session id.
 *
 * A reasonable amount of effort goes into ensuring that visitor information can
 * be tracked without waterfalling the critical path. To accomplish this, unlike
 * most screens, this screen does not currently support the interest provider
 */
export const CourseActivateScreen = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [visitor, setVisitor] = useState<StoredVisitor | null>(() => loadVisitorFromStore());
  const imageHandler = useOsehImageStateRequestHandler({});
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

  useEffect(() => {
    if (slug !== null && session !== null) {
      setLoginRedirect({
        url: window.location.origin + '/courses/attach',
        expiresAtMS: 1000 * 60 * 60 * 24,
      });
      localStorage.setItem('activated-course', JSON.stringify({ slug, session }));
    }
  }, [slug, session]);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (
          utm === null ||
          visitor === null ||
          loginContextUnch.state === 'loading' ||
          (associatedUTMWithVisitorUID.current !== null &&
            associatedUTMWithVisitorUID.current === visitor.uid)
        ) {
          return;
        }
        const currentUserSub =
          loginContextUnch.state === 'logged-in' ? loginContextUnch.userAttributes.sub : null;

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
            loginContextUnch.state === 'logged-in' ? loginContextUnch : null
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
          }
        }
      },
      [utm, visitor]
    )
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        let active = true;
        activateCourse();
        return () => {
          active = false;
        };

        async function activateCourseInner() {
          if (
            loginContextUnch.state === 'loading' ||
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
            loginContextUnch.state === 'logged-in' ? loginContextUnch : null
          );

          if (!response.ok) {
            throw response;
          }

          const data: { course: any; visitor_uid: string } = await response.json();
          const currentUserSub =
            loginContextUnch.state === 'logged-in' ? loginContextUnch.userAttributes.sub : null;
          if (
            visitor === null ||
            visitor.uid !== data.visitor_uid ||
            visitor.user?.sub !== currentUserSub
          ) {
            setVisitor({
              uid: data.visitor_uid,
              user: currentUserSub === null ? null : { sub: currentUserSub, time: Date.now() },
            });
          }

          const newCourse = convertUsingKeymap(data.course, courseKeyMap);
          setCourse(newCourse);
        }

        async function activateCourse() {
          await activateCourseInner();
        }
      },
      [slug, visitor, course, timezone, session]
    )
  );

  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const componentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (componentRef.current === null) {
      return;
    }
    const ele = componentRef.current;
    windowSizeVWC.callbacks.add(updateComponentStyle);
    updateComponentStyle();
    return () => {
      windowSizeVWC.callbacks.remove(updateComponentStyle);
    };

    function updateComponentStyle() {
      if (windowSizeVWC.get().height < 450) {
        ele.removeAttribute('style');
      } else {
        ele.style.height = `${windowSizeVWC.get().height}px`;
      }
    }
  }, [windowSizeVWC]);
  const background = useStaleOsehImageOnSwap(
    useOsehImageStateValueWithCallbacks(
      adaptValueWithCallbacksAsVariableStrategyProps(
        useMappedValueWithCallbacks(
          windowSizeVWC,
          (windowSize) => ({
            uid: course?.backgroundImage?.uid ?? null,
            jwt: course?.backgroundImage?.jwt ?? null,
            displayWidth: windowSize.width,
            displayHeight: windowSize.height,
            alt: '',
            placeholderColor: '#121111',
          }),
          {
            inputEqualityFn: () => false,
          }
        )
      ),
      imageHandler
    )
  );
  const providers = useMappedValueWithCallbacks(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch): OauthProvider[] =>
        loginContextUnch.state === 'logged-out' ? ['Google', 'SignInWithApple', 'Direct'] : [],
      []
    )
  );
  const [urls, urlsError] = useOauthProviderUrlsValueWithCallbacks(providers);
  useErrorModal(modalContext.modals, urlsError, 'oauth provider urls');
  const backgroundLoading = useMappedValueWithCallbacks(background, (bg) => bg.loading);

  if (slug === null || session === null) {
    return (
      <div className={styles.container}>
        <div className={styles.imageContainer}>
          <RenderGuardedComponent
            props={windowSizeVWC}
            component={(windowSize) => (
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
                handler={imageHandler}
              />
            )}
          />
        </div>
        <div className={styles.innerContainer}>
          <div className={styles.primaryContainer} ref={componentRef}>
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

  return (
    <RenderGuardedComponent
      props={loginContextRaw.value}
      component={(loginContextUnch) => {
        if (course === null || backgroundLoading || loginContextUnch.state === 'loading') {
          return <SplashScreen type="wordmark" />;
        }

        if (loginContextUnch.state === 'logged-out') {
          if (urls === null) {
            return <SplashScreen type="wordmark" />;
          }

          return (
            <div className={styles.container}>
              <div className={styles.imageContainer}>
                <OsehImageFromStateValueWithCallbacks state={background} />
              </div>
              <div className={styles.innerContainer}>
                <div className={styles.primaryContainer} ref={componentRef}>
                  <div className={styles.logoAndInfoContainer}>
                    <div className={styles.logoContainer}>
                      <div className={styles.logo} />
                      <div className={assistiveStyles.srOnly}>Oseh</div>
                    </div>
                    <div className={styles.info}>
                      Hive-five on your {course.title}. Login below to continue building a
                      mindfulness habit.
                    </div>
                  </div>
                  <div className={styles.socialSigninsContainer}>
                    <RenderGuardedComponent
                      props={urls}
                      component={(items) => <ProvidersList items={items} />}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return <CourseAttachScreen />;
      }}
    />
  );
};
