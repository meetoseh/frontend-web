import { ReactElement, useContext } from 'react';
import { LoggedOutPage } from '../core/lib/handleTouchLink';
import styles from './FastUnsubscribeLoginApp.module.css';
import { GridFullscreenContainer } from '../../shared/components/GridFullscreenContainer';
import { ScreenContext } from '../core/hooks/useScreenContext';
import { GridDarkGrayBackground } from '../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../shared/components/VerticalSpacer';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { OauthProvider } from './lib/OauthProvider';
import { useOauthProviderUrlsValueWithCallbacks } from './hooks/useOauthProviderUrlsValueWithCallbacks';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { ProvidersList } from './components/ProvidersList';
import { TextInput } from '../../shared/forms/TextInput';
import { setVWC } from '../../shared/lib/setVWC';
import { useWorkingModal } from '../../shared/hooks/useWorkingModal';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../shared/forms/Button';
import { screenWithWorking } from '../core/lib/screenWithWorking';
import { apiFetch } from '../../shared/ApiConstants';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { chooseErrorFromStatus, DisplayableError } from '../../shared/lib/errors';

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 *
 * In addition, it allows the user to input their email address to unsubscribe
 * from reminders.
 */
export const FastUnsubscribeLoginApp = ({
  ctx,
  page,
}: {
  ctx: ScreenContext;
  page: LoggedOutPage & { pageIdentifier: 'unsubscribe' };
}): ReactElement => {
  const providers = useWritableValueWithCallbacks<OauthProvider[]>(() => [
    'Google',
    'SignInWithApple',
    'Direct',
  ]);
  const [urls, urlsError] = useOauthProviderUrlsValueWithCallbacks(providers);
  const error = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const unsubscribeError = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const unsubscribingVWC = useWritableValueWithCallbacks(() => false);

  const modalContext = useContext(ModalContext);
  useErrorModal(modalContext.modals, error);
  useErrorModal(modalContext.modals, urlsError);
  useErrorModal(modalContext.modals, unsubscribeError);
  useWorkingModal(modalContext.modals, unsubscribingVWC);

  const emailAddressVWC = useWritableValueWithCallbacks<string>(() => '');
  const emailAddressValidVWC = useMappedValueWithCallbacks(
    emailAddressVWC,
    (v) => v.trim().length > 0 && v.includes('@')
  );

  const onFormSubmit = () => {
    screenWithWorking(unsubscribingVWC, async () => {
      const email = emailAddressVWC.get().trim();
      if (email.length === 0 || !email.includes('@')) {
        setVWC(unsubscribeError, new DisplayableError('client', 'unsubscribe', 'invalid email'));
        return;
      }

      const visitor = ctx.interests.visitor.value.get();
      const userUnch = ctx.login.value.get();
      const user = userUnch.state === 'logged-in' ? userUnch : null;

      setVWC(unsubscribeError, null);
      try {
        let response;
        try {
          response = await apiFetch(
            '/api/1/notifications/unsubscribe_by_email',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                ...(!visitor.loading && visitor.uid !== null ? { Visitor: visitor.uid } : {}),
              },
              body: JSON.stringify({
                email: email,
                code: page.code,
              }),
            },
            user
          );
        } catch {
          throw new DisplayableError('connectivity', 'unsubscribe');
        }

        if (!response.ok) {
          if (response.status === 403) {
            setVWC(unsubscribeError, new DisplayableError('client', 'unsubscribe', 'invalid code'));
            return;
          }
          throw chooseErrorFromStatus(response.status, 'unsubscribe');
        }

        await showYesNoModal(modalContext.modals, {
          title: 'Unsubscribed',
          body: `${email} has been unsubscribed from reminders from Oseh`,
          cta1: 'Okay',
          emphasize: 1,
        }).promise;
      } catch (e) {
        const err =
          e instanceof DisplayableError ? e : new DisplayableError('client', 'unsubscribe', `${e}`);
        setVWC(unsubscribeError, err);
      }
    });
  };

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={32} />
        <div className={styles.top}>📋 Configure Reminders from Oseh</div>
        <VerticalSpacer height={0} flexGrow={3} />
        <div className={styles.header}>Login or Enter Email Address</div>
        <VerticalSpacer height={32} />
        <div className={styles.message}>
          You can update your reminders by logging in. Alternatively, you can email support at{' '}
          <a href="mailto:hi@oseh.com">hi@oseh.com</a> or enter your email address to disable
          reminders.
        </div>
        <VerticalSpacer height={16} flexGrow={1} />
        <RenderGuardedComponent
          props={urls}
          component={(items) => <ProvidersList items={items} />}
        />
        <VerticalSpacer height={16} flexGrow={1} />
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            onFormSubmit();
          }}>
          <RenderGuardedComponent
            props={emailAddressVWC}
            component={(emailAddress) => (
              <TextInput
                type="email"
                label="Email Address"
                value={emailAddress}
                onChange={(v) => setVWC(emailAddressVWC, v)}
                help="Turn off email reminders without logging in"
                html5Validation={{
                  required: true,
                  autoComplete: 'email',
                }}
                disabled={false}
                inputStyle="white"
              />
            )}
            applyInstantly
          />
          <VerticalSpacer height={12} />
          <RenderGuardedComponent
            props={emailAddressValidVWC}
            component={(valid) => (
              <Button
                type="submit"
                variant="outlined-white"
                disabled={!valid}
                onClick={(e) => {
                  e.preventDefault();
                  onFormSubmit();
                }}>
                Unsubscribe
              </Button>
            )}
          />
        </form>
        <VerticalSpacer height={32} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
