import { ReactElement, useCallback, useContext } from 'react';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useTimezone } from '../../../../shared/hooks/useTimezone';
import { apiFetch } from '../../../../shared/ApiConstants';
import styles from './RequestPhone.module.css';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { TextInput } from '../../../../shared/forms/TextInput';
import { Button } from '../../../../shared/forms/Button';
import { FeatureComponentProps } from '../../models/Feature';
import { RequestPhoneState } from './RequestPhoneState';
import { RequestPhoneResources } from './RequestPhoneResources';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import {
  InterestsContext,
  InterestsContextValue,
} from '../../../../shared/contexts/InterestsContext';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';

/**
 * Prompts the user for their phone number, then verifies it.
 */
export const RequestPhone = ({
  state,
  resources,
}: FeatureComponentProps<RequestPhoneState, RequestPhoneResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const interests = useContext(InterestsContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const step = useWritableValueWithCallbacks<'number' | 'verify' | 'done'>(() => 'number');
  const phone = useWritableValueWithCallbacks<string>(() => '');
  const receiveNotifs = true;
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const saving = useWritableValueWithCallbacks<boolean>(() => false);
  const code = useWritableValueWithCallbacks<string>(() => '');
  const focusPhone = useWritableValueWithCallbacks<(() => void) | null>(() => null);
  const errorPhone = useWritableValueWithCallbacks<boolean>(() => false);
  const verificationUid = useWritableValueWithCallbacks<string | null>(() => null);
  const timezone = useTimezone();
  useStartSession({
    type: 'callbacks',
    props: () => resources.get().session,
    callbacks: resources.callbacks,
  });

  const safeSetFocusPhone = useCallback(
    (focuser: () => void) => {
      setVWC(focusPhone, () => focuser);
    },
    [focusPhone]
  );

  const formatAndSetPhone = useCallback(
    async (newValue: string) => {
      setVWC(errorPhone, false);

      if (newValue === '+') {
        setVWC(phone, '+');
        return;
      }

      if (newValue[0] === '+' && newValue[1] !== '1') {
        // international number; we'll just let them type it
        setVWC(phone, newValue);
        return;
      }

      let stripped = newValue.replace(/[^0-9]/g, '');

      if (newValue.endsWith('-')) {
        // they backspaced a space
        stripped = stripped.slice(0, -1);
      }

      if (stripped.length === 0) {
        setVWC(phone, '');
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

      setVWC(phone, result);
    },
    [phone, errorPhone]
  );

  const phoneFormatCorrect = useMappedValueWithCallbacks(phone, (phone) => {
    if (phone.length < 3) {
      return false;
    }

    if (phone[0] === '+' && phone[1] !== '1') {
      // we don't bother validating international numbers
      return true;
    }

    // +1123 - 456 - 7890
    return phone.length === 18;
  });

  const onStartPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loginContext.state !== 'logged-in') {
        setVWC(error, <>You need to be logged in to do that.</>);
        return;
      }

      if (!phoneFormatCorrect.get()) {
        const focusPhoneFn = focusPhone.get();
        if (focusPhoneFn) {
          focusPhoneFn();
        }
        setVWC(errorPhone, true);
        return;
      }

      const phoneNumber = phone.get();

      resources
        .get()
        .session?.storeAction?.call(undefined, 'continue', { pn: phoneNumber, tz: timezone });
      setVWC(saving, true);
      setVWC(error, null);
      try {
        const response = await apiFetch(
          '/api/1/phones/verify/start',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              phone_number: phoneNumber,
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
        setVWC(verificationUid, data.uid);
        setVWC(step, 'verify');
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setVWC(error, err);
      } finally {
        setVWC(saving, false);
      }
    },
    [
      loginContext,
      phoneFormatCorrect,
      focusPhone,
      phone,
      receiveNotifs,
      timezone,
      resources,
      error,
      saving,
      errorPhone,
      step,
      verificationUid,
    ]
  );

  const onVerifyPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loginContext.state !== 'logged-in') {
        setVWC(error, <>You need to be logged in to do that.</>);
        return;
      }

      const phoneNumber = phone.get().replaceAll(/ - /g, '');

      resources.get().session?.storeAction?.call(undefined, 'verify_start', null);
      setVWC(saving, true);
      setVWC(error, null);
      try {
        const response = await apiFetch(
          '/api/1/phones/verify/finish',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              uid: verificationUid.get(),
              code: code.get(),
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        await loginContext.setUserAttributes({
          ...loginContext.userAttributes!,
          phoneNumber,
        });
        resources.get().session?.storeAction?.call(undefined, 'verify_success', null);
        setVWC(step, 'done');
      } catch (e) {
        resources.get().session?.storeAction?.call(undefined, 'verify_fail', null);
        console.error(e);
        const err = await describeError(e);
        setVWC(error, err);
      } finally {
        setVWC(saving, false);
      }
    },
    [loginContext, code, phone, verificationUid, resources, error, saving, step]
  );

  const onSkipPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const res = resources.get();
      const st = state.get();

      if (res.session !== null) {
        res.session.storeAction('skip', null);
        res.session.reset();
        if (res.session.inappNotificationUid === st.phoneNumberIAN?.uid) {
          st.phoneNumberIAN.onShown();
        } else if (res.session.inappNotificationUid === st.onboardingPhoneNumberIAN?.uid) {
          st.onboardingPhoneNumberIAN.onShown();
        }
      }
    },
    [state, resources]
  );

  const onBackVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      resources.get().session?.storeAction?.call(undefined, 'verify_back', null);
      setVWC(error, null);
      setVWC(verificationUid, null);
      setVWC(step, 'number');
    },
    [resources, error, verificationUid, step]
  );

  const phoneInputData = useMappedValuesWithCallbacks([phone, errorPhone, saving], () => ({
    phone: phone.get(),
    errorPhone: errorPhone.get(),
    saving: saving.get(),
  }));

  const codeInputData = useMappedValuesWithCallbacks([code, saving], () => ({
    code: code.get(),
    saving: saving.get(),
  }));

  const modalContext = useContext(ModalContext);

  useErrorModal(modalContext.modals, error, 'request or verify phone');

  return (
    <div className={combineClasses(styles.container, styles[`container-${step}`])}>
      <div className={styles.imageContainer}>
        <RenderGuardedComponent
          props={windowSizeVWC}
          component={(windowSize) => (
            <div
              className={styles.background}
              style={{ width: `${windowSize.width}px`, height: `${windowSize.height}px` }}
            />
          )}
        />
      </div>
      <div className={styles.content}>
        <RenderGuardedComponent
          props={step}
          component={(step) => (
            <>
              {step === 'number' && (
                <>
                  <div className={styles.iconOuterContainer}>
                    <div className={styles.iconInnerContainer}>
                      <div className={styles.icon} />
                      <div className={styles.iconDot} />
                    </div>
                  </div>
                  <div className={styles.title}>{phoneStepTitle(interests)}</div>
                  <div className={styles.subtitle}>
                    Sign up for daily text reminders by entering your phone number below.
                  </div>
                  <form className={styles.form} onSubmit={onStartPhone}>
                    <div className={styles.phoneNumberContainer}>
                      <RenderGuardedComponent
                        props={phoneInputData}
                        component={({ phone, errorPhone, saving }) => (
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
                        )}
                      />
                    </div>

                    <div className={styles.submitContainer}>
                      <RenderGuardedComponent
                        props={saving}
                        component={(saving) => (
                          <Button
                            type="submit"
                            variant="filled-white"
                            disabled={saving}
                            fullWidth={true}>
                            Verify Phone
                          </Button>
                        )}
                      />
                    </div>

                    <div className={styles.skipContainer}>
                      <RenderGuardedComponent
                        props={saving}
                        component={(saving) => (
                          <Button
                            type="button"
                            disabled={saving}
                            fullWidth={true}
                            variant="link-white"
                            onClick={onSkipPhone}>
                            Skip
                          </Button>
                        )}
                      />
                    </div>

                    <div className={styles.getNotifiedContainer}>
                      By continuing you agree to our <a href="https://www.oseh.com/terms">Terms</a>{' '}
                      and <a href="https://www.oseh.com/privacy">Privacy Policy</a>, and to receive
                      marketing messages from Oseh. Msg & data rates may apply. Approx. 1 message
                      per day. Consent is not a condition of signup. Text HELP for help or STOP to
                      cancel.
                    </div>
                  </form>
                </>
              )}
              {step === 'verify' && (
                <>
                  <div className={styles.title}>Enter Verification Code</div>
                  <div className={styles.subtitle}>
                    We&rsquo;ve sent a text message with a 6-digit verification code to{' '}
                    <RenderGuardedComponent
                      props={phone}
                      component={(phone) => <strong>{phone}</strong>}
                    />
                  </div>
                  <form className={styles.form} onSubmit={onVerifyPhone}>
                    <div className={styles.codeContainer}>
                      <RenderGuardedComponent
                        props={codeInputData}
                        component={(props) => (
                          <TextInput
                            label="Code"
                            value={props.code}
                            help={null}
                            disabled={props.saving}
                            inputStyle={'white'}
                            onChange={(newCode) => setVWC(code, newCode)}
                            type="number"
                            html5Validation={{ required: true, min: 0, max: 999999 }}
                            hideNumberSpinner={true}
                          />
                        )}
                      />
                    </div>

                    <div className={styles.submitContainer}>
                      <RenderGuardedComponent
                        props={saving}
                        component={(saving) => (
                          <Button
                            type="submit"
                            variant="filled-white"
                            disabled={saving}
                            fullWidth={true}>
                            Continue
                          </Button>
                        )}
                      />
                    </div>

                    <div className={styles.skipContainer}>
                      <RenderGuardedComponent
                        props={saving}
                        component={(saving) => (
                          <Button
                            type="button"
                            disabled={saving}
                            fullWidth={true}
                            variant="link-white"
                            onClick={onBackVerify}>
                            Back
                          </Button>
                        )}
                      />
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        />
      </div>
    </div>
  );
};

const phoneStepTitle = (interests: InterestsContextValue): ReactElement => {
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
        Relax every day with <span style={{ whiteSpace: 'nowrap' }}>friendly nudges</span>
      </>
    );
  } else if (interests.primaryInterest === 'sleep') {
    return (
      <>
        Sleep easier every day with <span style={{ whiteSpace: 'nowrap' }}>friendly nudges</span>
      </>
    );
  } else if (interests.primaryInterest === 'isaiah-course') {
    return <>Oseh is much better with notifications</>;
  } else {
    return defaultCopy;
  }
};
