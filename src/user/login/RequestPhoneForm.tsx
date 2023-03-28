import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Button } from '../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { TextInput } from '../../shared/forms/TextInput';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext } from '../../shared/LoginContext';
import { OsehImage } from '../../shared/OsehImage';
import styles from './RequestPhoneForm.module.css';
import '../../assets/fonts.css';
import { apiFetch } from '../../shared/ApiConstants';
import { useTimezone } from '../../shared/hooks/useTimezone';
import { combineClasses } from '../../shared/lib/combineClasses';

type RequestPhoneFormProps = {
  /**
   * Called to indicate the loaded status of the form
   * @param loaded If all the content for the form is ready
   */
  setLoaded: (loaded: boolean) => void;

  /**
   * Called when the user requests to skip this step
   */
  onSkipped: () => void;

  /**
   * Called after we successfully verify a phone number. Instead of this, one
   * call also monitor the userAttributes.phoneNumber attribute for changes.
   */
  onFinished: (requestedNotifications: boolean) => void;

  /**
   * If set to false, the final button is disabled, preventing the
   * user from finishing the form.
   */
  readyToFinish?: boolean;
};

/**
 * Shows a form where the user can put in a phone number and verify it.
 * If it verifies successfully, it becomes their primary phone number.
 */
export const RequestPhoneForm = ({
  setLoaded,
  onSkipped,
  onFinished,
  readyToFinish,
}: RequestPhoneFormProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [step, setStep] = useState<'number' | 'verify' | 'reward'>('number');
  const [phone, setPhone] = useState('');
  const receiveNotifs = true;
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [code, setCode] = useState('');
  const [focusPhone, setFocusPhone] = useState<(() => void) | null>(null);
  const [errorPhone, setErrorPhone] = useState(false);
  const [verificationUid, setVerificationUid] = useState<string | null>(null);
  const timezone = useTimezone();

  const safeSetFocusPhone = useCallback((focuser: () => void) => {
    setFocusPhone(() => focuser);
  }, []);

  useEffect(() => {
    setLoaded(!imageLoading);
  }, [imageLoading, setLoaded]);

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
    [loginContext, phoneFormatCorrect, focusPhone, phone, receiveNotifs, timezone]
  );

  const onVerifyPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loginContext.state !== 'logged-in') {
        setError(<>You need to be logged in to do that.</>);
        return;
      }

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
        setStep('reward');
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setError(err);
      } finally {
        setSaving(false);
      }
    },
    [loginContext, code, phone, verificationUid]
  );

  const onRewardFinish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onFinished(receiveNotifs);
    },
    [onFinished, receiveNotifs]
  );

  const onSkipPhone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      onSkipped();
    },
    [onSkipped]
  );

  const onBackVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerificationUid(null);
    setStep('number');
  }, []);

  return (
    <div className={combineClasses(styles.container, styles[`container-${step}`])}>
      <div className={styles.imageContainer}>
        <OsehImage
          uid="oseh_if_hH68hcmVBYHanoivLMgstg"
          jwt={null}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          isPublic={true}
          setLoading={setImageLoading}
        />
      </div>
      <div className={styles.content}>
        {step === 'number' && (
          <>
            <div className={styles.title}>Oseh is way better with notifications</div>
            <div className={styles.subtitle}>
              The only way to know when to take a class is to enter your phone number below.
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
                messages from Oseh. Msg & data rates may apply. Approx. 1 message per day. Text HELP
                for help or STOP to cancel.
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
        {step === 'reward' && (
          <>
            <div className={styles.rewardTitle}>
              Awesome! You&rsquo;re one step closer to creating a mindfulness habit.
            </div>
            {/* https://www.jneurosci.org/content/31/14/5540 */}
            <div className={styles.rewardFact}>
              Mindfulness has been associated with the perceived reduction of pain in participants
              by upwards of 50%.
            </div>
            <div className={styles.submitContainer}>
              <Button
                type="button"
                fullWidth
                onClick={onRewardFinish}
                disabled={readyToFinish === false}>
                Let&rsquo;s Go
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
