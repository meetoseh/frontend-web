import { ReactElement, useCallback, useEffect, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { MergeAccountState, MergeProvider } from './MergeAccountState';
import { MergeAccountResources } from './MergeAccountResources';
import styles from './MergeAccount.module.css';
import loginStyles from '../../../login/LoginApp.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../../../shared/forms/Button';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useFullHeight } from '../../../../shared/hooks/useFullHeight';
import { IconButton } from '../../../../shared/forms/IconButton';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';

export const MergeAccount = ({
  resources,
  state,
}: FeatureComponentProps<MergeAccountState, MergeAccountResources>): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const windowSize = useWindowSizeValueWithCallbacks();

  useStartSession(
    {
      type: 'callbacks',
      props: () => resources.get().session,
      callbacks: resources.callbacks,
    },
    {
      onStart: () => {
        resources.get().session?.storeAction('open', {
          merge_suggestions: (state.get().mergeSuggestions ?? []).map((s) => s.provider),
        });
      },
    }
  );

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC: windowSize });

  const onCloseClick = useCallback(() => {
    resources.get().session?.storeAction('x', null);

    const s = state.get();
    s.ian?.onShown();
    s.onSuggestionsDismissed();
  }, [resources, state]);

  const onLeavingWith = useCallback(
    (provider: MergeProvider) => {
      resources.get().session?.storeAction('continue_with_provider', { provider });

      const s = state.get();
      s.ian?.onShown();
      s.onSuggestionsDismissed();
    },
    [resources, state]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.background} />
      <div className={styles.contentContainer}>
        <div className={styles.closeButtonContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
        </div>
        <div className={styles.content}>
          <div className={styles.header}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(resources, (r) => r.givenName)}
              component={(name) => (
                <>
                  {name && name !== 'Anonymous' && (
                    <div className={styles.headerLine}>Hi, {name}!</div>
                  )}
                </>
              )}
            />
            <div className={styles.headerLine}>Welcome back.</div>
          </div>
          <div className={styles.body}>
            It looks like you have created an account with us before. Please try logging in again
            with{' '}
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(
                resources,
                (r) =>
                  new Set(
                    Object.keys(r.providerUrls ?? {}).filter(
                      (k) => !!(r.providerUrls as Record<string, string | null> | null)?.[k]
                    )
                  ),
                {
                  outputEqualityFn: (a, b) =>
                    a.size === b.size && Array.from(a).every((v) => b.has(v)),
                }
              )}
              component={(providers) => (
                <>
                  {Array.from(providers)
                    .sort()
                    .map(
                      (p) =>
                        ({
                          Google: 'Google',
                          SignInWithApple: 'Apple',
                          Direct: 'email',
                          Dev: 'dev',
                        }[p])
                    )
                    .filter((p) => p !== undefined)
                    .join(' or ')}
                </>
              )}
            />
          </div>
          <div className={styles.providers}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(resources, (r) => r.providerUrls)}
              component={(urls) => ProviderUrls(onLeavingWith, urls)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ProviderUrls = (
  onLeavingWith: (provider: MergeProvider) => void,
  urls: MergeAccountResources['providerUrls']
): ReactElement => {
  const googleRef = useRef<HTMLDivElement>(null);
  const appleRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const google = googleRef.current;
    const apple = appleRef.current;
    const email = emailRef.current;

    if (google === null || apple === null || email === null) {
      return;
    }

    google.removeAttribute('style');
    apple.removeAttribute('style');
    email.removeAttribute('style');

    const googleWidth = google.offsetWidth;
    const appleWidth = apple.offsetWidth;
    const emailWidth = email.offsetWidth;

    const maxWidth = Math.max(googleWidth, appleWidth, emailWidth);

    google.style.paddingRight = `${maxWidth - googleWidth}px`;
    apple.style.paddingRight = `${maxWidth - appleWidth}px`;
    email.style.paddingRight = `${maxWidth - emailWidth}px`;
  }, []);

  return (
    <>
      {urls && urls.Google && (
        <Button
          type="button"
          variant="filled-white"
          onClick={urls.Google}
          onLinkClick={() => onLeavingWith('Google')}>
          <div className={loginStyles.iconAndText}>
            <div className={loginStyles.signInWithGoogleIcon}></div>
            <div ref={googleRef}>Sign in with Google</div>
          </div>
        </Button>
      )}
      {urls && urls.SignInWithApple && (
        <Button
          type="button"
          variant="filled-white"
          onClick={urls.SignInWithApple}
          onLinkClick={() => onLeavingWith('SignInWithApple')}>
          <div className={loginStyles.iconAndText}>
            <div className={loginStyles.signInWithAppleIcon}></div>
            <div ref={appleRef}>Sign in with Apple</div>
          </div>
        </Button>
      )}
      {urls && urls.Direct && (
        <Button
          type="button"
          variant="filled-white"
          onClick={urls.Direct}
          onLinkClick={() => onLeavingWith('Direct')}>
          <div className={loginStyles.iconAndText}>
            <div className={loginStyles.signInWithEmailIcon}></div>
            <div ref={emailRef}>Sign in with Email</div>
          </div>
        </Button>
      )}
      {urls && urls.Dev && (
        <Button
          type="button"
          variant="filled-white"
          onClick={urls.Dev}
          onLinkClick={() => onLeavingWith('Dev')}>
          <div className={loginStyles.iconAndText}>
            <div className={loginStyles.signInWithEmailIcon}></div>
            <div ref={emailRef}>Sign in with Dev</div>
          </div>
        </Button>
      )}
    </>
  );
};
