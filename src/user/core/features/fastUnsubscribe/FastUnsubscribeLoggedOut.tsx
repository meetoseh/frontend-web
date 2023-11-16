import { ReactElement, useCallback, useContext, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { FastUnsubscribeResources } from './FastUnsubscribeResources';
import { FastUnsubscribeState } from './FastUnsubscribeState';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import styles from './FastUnsubscribeLoggedOut.module.css';
import { useFullHeight } from '../../../../shared/hooks/useFullHeight';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { SocialSignins } from '../../../login/LoginApp';
import { TextInput } from '../../../../shared/forms/TextInput';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Button } from '../../../../shared/forms/Button';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { IconButton } from '../../../../shared/forms/IconButton';

/**
 * The component used for the logged out variant of the fast unsubscribe
 * screen, which allows the user to enter an email address or login and
 * proceed to the logged in variant.
 */
export const FastUnsubscribeLoggedOut = ({
  state,
  resources,
}: FeatureComponentProps<FastUnsubscribeState, FastUnsubscribeResources>): ReactElement => {
  const windowSize = useWindowSizeValueWithCallbacks();
  const containerRef = useRef<HTMLDivElement>(null);
  const email = useWritableValueWithCallbacks<string>(() => '');
  const saving = useWritableValueWithCallbacks<boolean>(() => false);
  const formError = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const finished = useWritableValueWithCallbacks<boolean>(() => false);
  const interests = useContext(InterestsContext);
  const loginContext = useContext(LoginContext);

  const setEmail = useCallback(
    (value: string) => {
      setVWC(email, value);
    },
    [email]
  );

  const onFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setVWC(saving, true);
      setVWC(formError, null);
      try {
        const response = await apiFetch(
          '/api/1/notifications/unsubscribe_by_email',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...(interests.state !== 'loading' &&
              !interests.visitor.loading &&
              interests.visitor.uid !== null
                ? { Visitor: interests.visitor.uid }
                : {}),
            },
            body: JSON.stringify({
              email: email.get(),
              code: resources.get().code,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          if (response.status === 403) {
            setVWC(
              formError,
              <div className={styles.badCodeError}>
                The link you took appears to be invalid. Contact support at{' '}
                <a href="mailto:hi@oseh.com">hi@oseh.com</a>
              </div>
            );
            return;
          }
          throw response;
        }

        setVWC(finished, true);
      } catch (e) {
        setVWC(formError, await describeError(e));
      } finally {
        setVWC(saving, false);
      }
    },
    [saving, formError, loginContext, interests, email, finished, resources]
  );

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC: windowSize });

  const socialUrlsProps = useMappedValueWithCallbacks(
    resources,
    (r) => [r.socialUrls, r.socialUrlsError] as const
  );

  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.get().onDismiss();
    },
    [resources]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.background} />
      <div className={styles.contentContainer}>
        <div className={styles.closeButtonContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
        </div>
        <div className={styles.content}>
          <div className={styles.logo} />

          <RenderGuardedComponent
            props={finished}
            component={(fin) =>
              !fin ? (
                <>
                  <RenderGuardedComponent
                    props={socialUrlsProps}
                    component={([socialUrls, socialUrlsError]) => {
                      if (socialUrlsError !== null && socialUrlsError !== undefined) {
                        return socialUrlsError;
                      }

                      if (socialUrls === null || socialUrls === undefined) {
                        return <div style={{ height: '132px' }} />;
                      }

                      return (
                        <div className={styles.loginSection}>
                          <div className={styles.loginSectionTitle}>
                            Login for notification preferences
                          </div>
                          <SocialSignins urls={socialUrls} noTests />
                        </div>
                      );
                    }}
                  />
                  <div className={styles.or}>or</div>
                  <div className={styles.quickUnsubscribeSection}>
                    <div className={styles.quickUnsubscribeSectionTitle}>
                      Enter your email to unsubscribe from daily notifications
                    </div>
                    <RenderGuardedComponent
                      props={saving}
                      component={(disabled) => (
                        <form className={styles.form} onSubmit={onFormSubmit}>
                          <RenderGuardedComponent
                            props={email}
                            component={(value) => (
                              <TextInput
                                label="Email Address"
                                value={value}
                                inputStyle="white"
                                type="email"
                                onChange={setEmail}
                                html5Validation={{ required: true, autoComplete: 'email' }}
                                help={null}
                                disabled={disabled}
                              />
                            )}
                          />
                          <RenderGuardedComponent
                            props={formError}
                            component={(e) =>
                              e === null ? <></> : <div className={styles.formError}>{e}</div>
                            }
                          />
                          <Button
                            type="submit"
                            variant="outlined-white"
                            fullWidth
                            disabled={disabled}
                            spinner={disabled}>
                            Continue
                          </Button>
                        </form>
                      )}
                    />
                  </div>
                </>
              ) : (
                <div className={styles.quickUnsubscribedConfirmation}>
                  <RenderGuardedComponent props={email} component={(e) => <>{e}</>} /> has been
                  successfully unsubscribed
                </div>
              )
            }
          />
        </div>
      </div>
    </div>
  );
};
