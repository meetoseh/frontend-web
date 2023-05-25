import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { LoginContext } from '../../../../shared/LoginContext';
import { useTimezone } from '../../../../shared/hooks/useTimezone';
import { apiFetch } from '../../../../shared/ApiConstants';
import styles from './RequestPhone.module.css';
import { ErrorBlock, describeError } from '../../../../shared/forms/ErrorBlock';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { SplashScreen } from '../../../splash/SplashScreen';
import { OsehImageFromState } from '../../../../shared/OsehImage';
import { TextInput } from '../../../../shared/forms/TextInput';
import { Button } from '../../../../shared/forms/Button';
import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { RequestPhoneState } from './RequestPhoneState';
import { RequestPhoneResources } from './RequestPhoneResources';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/InterestsContext';

/**
 * Prompts the user for their phone number, then verifies it.
 */
export const RequestPhone = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<RequestPhoneState, RequestPhoneResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const interests = useContext(InterestsContext);
  const [step, setStep] = useState<'number' | 'verify' | 'done'>('number');
  const [phone, setPhone] = useState('');
  const receiveNotifs = true;
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [focusPhone, setFocusPhone] = useState<(() => void) | null>(null);
  const [errorPhone, setErrorPhone] = useState(false);
  const [verificationUid, setVerificationUid] = useState<string | null>(null);
  const timezone = useTimezone();
  useStartSession(resources.session);

  const safeSetFocusPhone = useCallback((focuser: () => void) => {
    setFocusPhone(() => focuser);
  }, []);

  const formatAndSetPhone = useCallback(async (newValue: string) => {
    setErrorPhone(false);

    if (newValue === '+') {
      setPhone('+');
      return;
    }

    if (newValue[0] === '+' && newValue[1] !== '1') {
      // international number; we'll just let them type it
      setPhone(newValue);
      return;
    }

    let stripped = newValue.replace(/[^0-9]/g, '');

    if (newValue.endsWith('-')) {
      // they backspaced a space
      stripped = stripped.slice(0, -1);
    }

    if (stripped.length === 0) {
      setPhone('');
      return;
    }

    let result = stripped;
    if (result[0] !== '1') {
      result = '+1' + result;
    } else {
      result = '+' + result;
    }

    // +1123
    if (result.length >= 5) {
      result = result.slice(0, 5) + ' - ' + result.slice(5);
    }

    // +1123 - 456
    if (result.length >= 11) {
      result = result.slice(0, 11) + ' - ' + result.slice(11);
    }

    setPhone(result);
  }, []);

  const phoneFormatCorrect = useMemo(() => {
    if (phone.length < 3) {
      return false;
    }

    if (phone[0] === '+' && phone[1] !== '1') {
      // we don't bother validating international numbers
      return true;
    }

    // +1123 - 456 - 7890
    return phone.length === 18;
  }, [phone]);

  const onStartPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loginContext.state !== 'logged-in') {
        setError(<>You need to be logged in to do that.</>);
        return;
      }

      if (!phoneFormatCorrect) {
        if (focusPhone) {
          focusPhone();
        }
        setErrorPhone(true);
        return;
      }

      resources.session?.storeAction?.call(undefined, 'continue', { pn: phone, tz: timezone });
      setSaving(true);
      setError(null);
      try {
        const response = await apiFetch(
          '/api/1/phones/verify/start',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              phone_number: phone,
              receive_notifications: receiveNotifs,
              timezone,
              timezone_technique: 'browser',
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        setVerificationUid(data.uid);
        setStep('verify');
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setError(err);
      } finally {
        setSaving(false);
      }
    },
    [
      loginContext,
      phoneFormatCorrect,
      focusPhone,
      phone,
      receiveNotifs,
      timezone,
      resources.session?.storeAction,
    ]
  );

  const onVerifyPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loginContext.state !== 'logged-in') {
        setError(<>You need to be logged in to do that.</>);
        return;
      }

      resources.session?.storeAction?.call(undefined, 'verify_start', null);
      setSaving(true);
      setError(null);
      try {
        const response = await apiFetch(
          '/api/1/phones/verify/finish',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              uid: verificationUid,
              code,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        await loginContext.setUserAttributes({
          ...loginContext.userAttributes!,
          phoneNumber: phone.replaceAll(/ - /g, ''),
        });
        resources.session?.storeAction?.call(undefined, 'verify_success', null);
        setStep('done');
      } catch (e) {
        resources.session?.storeAction?.call(undefined, 'verify_fail', null);
        console.error(e);
        const err = await describeError(e);
        setError(err);
      } finally {
        setSaving(false);
      }
    },
    [loginContext, code, phone, verificationUid, resources.session?.storeAction]
  );

  const onSkipPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      let newState: RequestPhoneState = state;
      if (resources.session !== null) {
        if (resources.session.inappNotificationUid === state.phoneNumberIAN?.uid) {
          newState = {
            ...state,
            phoneNumberIAN: state.phoneNumberIAN.onShown(),
          };
        } else if (resources.session.inappNotificationUid === state.onboardingPhoneNumberIAN?.uid) {
          newState = {
            ...state,
            onboardingPhoneNumberIAN: state.onboardingPhoneNumberIAN.onShown(),
          };
        }

        resources.session.storeAction('skip', null);
        resources.session.reset();
      }

      doAnticipateState(newState, Promise.resolve());
    },
    [state, resources.session, doAnticipateState]
  );

  const onBackVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      resources.session?.storeAction?.call(undefined, 'verify_back', null);
      setError(null);
      setVerificationUid(null);
      setStep('number');
    },
    [resources.session?.storeAction]
  );

  if (resources.background === null) {
    return <></>;
  }

  if (step === 'done') {
    return <SplashScreen />;
  }

  return (
    <div className={combineClasses(styles.container, styles[`container-${step}`])}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.background} />
      </div>
      <div className={styles.content}>
        {step === 'number' && (
          <>
            <div className={styles.title}>
              {(() => {
                const defaultCopy = (
                  <>
                    Let&rsquo;s create a daily mindfulness habit with{' '}
                    <span style={{ whiteSpace: 'nowrap' }}>friendly nudges</span>
                  </>
                );

                if (interests.state !== 'loaded') {
                  return defaultCopy;
                } else if (interests.primaryInterest === 'anxiety') {
                  return (
                    <>
                      Relax every day with{' '}
                      <span style={{ whiteSpace: 'nowrap' }}>friendly nudges</span>
                    </>
                  );
                } else if (interests.primaryInterest === 'sleep') {
                  return (
                    <>
                      Sleep easier every day with{' '}
                      <span style={{ whiteSpace: 'nowrap' }}>friendly nudges</span>
                    </>
                  );
                } else {
                  return defaultCopy;
                }
              })()}
            </div>
            <div className={styles.subtitle}>
              Sign up for daily text reminders by entering your phone number below.
            </div>
            <form className={styles.form} onSubmit={onStartPhone}>
              <div className={styles.phoneNumberContainer}>
                <TextInput
                  label="Phone Number"
                  value={phone}
                  help={errorPhone ? 'Please enter a valid phone number' : null}
                  disabled={saving}
                  inputStyle={errorPhone ? 'error-white' : 'white'}
                  onChange={formatAndSetPhone}
                  type="tel"
                  html5Validation={{ required: true }}
                  doFocus={safeSetFocusPhone}
                />
              </div>

              <div className={styles.getNotifiedContainer}>
                By continuing you agree to our <a href="https://www.oseh.com/terms">Terms</a> and{' '}
                <a href="https://www.oseh.com/privacy">Privacy Policy</a>, and to receive marketing
                messages from Oseh. Msg & data rates may apply. Approx. 1 message per day. Consent
                is not a condition of signup. Text HELP for help or STOP to cancel.
              </div>

              {error && (
                <div className={styles.errorContainer}>
                  <ErrorBlock>{error}</ErrorBlock>
                </div>
              )}

              <div className={styles.submitContainer}>
                <Button type="submit" disabled={saving} fullWidth={true}>
                  Continue
                </Button>
              </div>

              <div className={styles.skipContainer}>
                <Button
                  type="button"
                  disabled={saving}
                  fullWidth={true}
                  variant="link-white"
                  onClick={onSkipPhone}>
                  Skip
                </Button>
              </div>
            </form>
          </>
        )}
        {step === 'verify' && (
          <>
            <div className={styles.title}>Verify your phone</div>
            <form className={styles.form} onSubmit={onVerifyPhone}>
              <div className={styles.codeContainer}>
                <TextInput
                  label="Code"
                  value={code}
                  help={null}
                  disabled={saving}
                  inputStyle={'white'}
                  onChange={setCode}
                  type="number"
                  html5Validation={{ required: true, min: 0, max: 999999 }}
                  hideNumberSpinner={true}
                />
              </div>

              {error && (
                <div className={styles.errorContainer}>
                  <ErrorBlock>{error}</ErrorBlock>
                </div>
              )}

              <div className={styles.submitContainer}>
                <Button type="submit" disabled={saving} fullWidth={true}>
                  Continue
                </Button>
              </div>

              <div className={styles.skipContainer}>
                <Button
                  type="button"
                  disabled={saving}
                  fullWidth={true}
                  variant="link-white"
                  onClick={onBackVerify}>
                  Back
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
