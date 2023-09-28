import { ReactElement, useCallback, useContext, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { FastUnsubscribeResources } from './FastUnsubscribeResources';
import { FastUnsubscribeState } from './FastUnsubscribeState';
import styles from './FastUnsubscribeLoggedIn.module.css';
import { useFullHeight } from '../../../../shared/hooks/useFullHeight';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { IconButton } from '../../../../shared/forms/IconButton';
import { LoginContext, LoginContextValue } from '../../../../shared/contexts/LoginContext';
import { Button } from '../../../../shared/forms/Button';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { describeError } from '../../../../shared/forms/ErrorBlock';

type DailyReminderItem = {
  /** Unique identifier for the subscription */
  uid: string;
  /**
   * The earliest time in seconds from midnight when notifications
   * are sent to this subscription
   */
  startTime: number;
  /**
   * The latest time in seconds from midnight when notifications are sent
   * to this subscription
   */
  endTime: number;
  /**
   * The days of the week that notifications are sent to this subscription,
   * where the least significant bit is sunday and the most significant
   * bit is saturday
   */
  dayOfWeekMask: number;
  /**
   * When this subscription was created
   */
  createdAt: Date;
};

/**
 * Parses the daily reminder item api response
 */
const parseDailyReminderItem = (raw: any): DailyReminderItem => {
  return {
    uid: raw.uid,
    startTime: raw.start_time,
    endTime: raw.end_time,
    dayOfWeekMask: raw.day_of_week_mask,
    createdAt: new Date(raw.created_at * 1000),
  };
};

type DailyReminderSMSItem = DailyReminderItem & {
  /**
   * The phone number in E.164 format receiving notifications
   */
  phone: string;
};

/**
 * Parses the daily reminder sms item api response
 */
const parseDailyReminderSMSItem = (raw: any): DailyReminderSMSItem => {
  return {
    ...parseDailyReminderItem(raw),
    phone: raw.phone,
  };
};

type DailyReminderEmailItem = DailyReminderItem & {
  /**
   * The email address receiving notifications
   */
  email: string;
};

/**
 * Parses the daily reminder email item api response
 */
const parseDailyReminderEmailItem = (raw: any): DailyReminderEmailItem => {
  return {
    ...parseDailyReminderItem(raw),
    email: raw.email,
  };
};

type DailyReminderPushDevice = {
  /** A unique identifier for this device */
  uid: string;
  /** The platform for the device */
  platform: 'android' | 'ios' | 'generic';
  /**
   * When this device was created
   */
  createdAt: Date;
};

type DailyReminderPushItem = DailyReminderItem & {
  /** The devices receiving push notifications */
  devices: DailyReminderPushDevice[];
};

/**
 * Parses the daily reminder push item api response
 */
const parseDailyReminderPushItem = (raw: any): DailyReminderPushItem => {
  return {
    ...parseDailyReminderItem(raw),
    devices: raw.devices.map((d: any) => ({
      uid: d.uid,
      platform: d.platform,
      createdAt: new Date(d.created_at * 1000),
    })),
  };
};

export type DailyReminders = {
  /**
   * The sms subscription, if any
   */
  sms: DailyReminderSMSItem | null;
  /**
   * The email subscription, if any
   */
  email: DailyReminderEmailItem | null;
  /**
   * The push subscription, if any
   */
  push: DailyReminderPushItem | null;
};

/**
 * Parses the daily reminders api response
 */
export const parseDailyReminders = (raw: any): DailyReminders => {
  return {
    sms: raw.sms ? parseDailyReminderSMSItem(raw.sms) : null,
    email: raw.email ? parseDailyReminderEmailItem(raw.email) : null,
    push: raw.push ? parseDailyReminderPushItem(raw.push) : null,
  };
};

/**
 * The logged-in variant of the fast unsubscribe screen which allows a user
 * to see and turn on/off daily reminders on sms/email/push
 */
export const FastUnsubscribeLoggedIn = ({
  state,
  resources,
}: FeatureComponentProps<FastUnsubscribeState, FastUnsubscribeResources>): ReactElement => {
  const windowSize = useWindowSizeValueWithCallbacks();
  const containerRef = useRef<HTMLDivElement>(null);
  const sms = useMappedValueWithCallbacks(resources, (r) => r.dailyReminders?.sms ?? null);
  const email = useMappedValueWithCallbacks(resources, (r) => r.dailyReminders?.email ?? null);
  const push = useMappedValueWithCallbacks(resources, (r) => r.dailyReminders?.push ?? null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC: windowSize });

  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.get().onDismiss();
    },
    [resources]
  );

  const onSettingsClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.get().dismissAndGotoSettings();
    },
    [resources]
  );

  const loginContext = useContext(LoginContext);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.background} />
      <div className={styles.contentContainer}>
        <div className={styles.closeButtonContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
        </div>
        <div className={styles.content}>
          <div className={styles.subtitle}>
            <div>{loginContext?.userAttributes?.name}</div>
            <div>{loginContext?.userAttributes?.email}</div>
          </div>
          <div className={styles.title}>Daily Notifications</div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Unsubscribe from SMS</div>
            <RenderGuardedComponent props={sms} component={(sms) => <UnsubscribeSMS sms={sms} />} />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Unsubscribe from Email</div>
            <RenderGuardedComponent
              props={email}
              component={(email) => <UnsubscribeEmail email={email} />}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Unsubscribe from Push Notifications</div>
            <RenderGuardedComponent
              props={push}
              component={(push) => <UnsubscribePush push={push} />}
            />
          </div>
          <Button type="button" variant="outlined-white" onClick={onSettingsClick} fullWidth>
            Go To Settings
          </Button>
          <div className={styles.settingsHelp}>
            You can delete your account or contact support in settings.
          </div>
        </div>
      </div>
    </div>
  );
};

const unsubscribeByUID = async (
  saving: WritableValueWithCallbacks<boolean>,
  removed: WritableValueWithCallbacks<boolean>,
  error: WritableValueWithCallbacks<ReactElement | null>,
  uid: string | undefined,
  loginContext: LoginContextValue,
  e: React.MouseEvent<HTMLButtonElement>
) => {
  e.preventDefault();

  setVWC(saving, true);
  setVWC(error, null);
  try {
    const response = await apiFetch(
      '/api/1/users/me/daily_reminders',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          uid: uid,
        }),
      },
      loginContext
    );

    if (!response.ok) {
      if (response.status === 404) {
        setVWC(removed, true);
        return;
      }

      setVWC(error, await describeError(response));
    }

    setVWC(removed, true);
  } finally {
    setVWC(saving, false);
  }
};

const UnsubscribeItem = ({
  identifier,
  saving,
  removed,
  unsubscribe,
}: {
  identifier: string | ReactElement;
  saving: ValueWithCallbacks<boolean>;
  removed: ValueWithCallbacks<boolean>;
  unsubscribe: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  const buttonProps = useMappedValuesWithCallbacks(
    [saving, removed],
    () => [saving.get(), removed.get()] as const
  );

  return (
    <div className={styles.item}>
      <div className={styles.itemIdentifier}>{identifier}</div>
      <div className={styles.itemAction}>
        <RenderGuardedComponent
          props={buttonProps}
          component={([saving, removed]) => (
            <Button
              type="button"
              variant="filled-white"
              onClick={unsubscribe}
              disabled={saving || removed}
              spinner={saving}>
              Remove{removed ? 'd' : ''}
            </Button>
          )}
        />
      </div>
    </div>
  );
};

const UnsubscribeSMS = ({ sms }: { sms: DailyReminderSMSItem | null }): ReactElement => {
  const modals = useContext(ModalContext);
  const saving = useWritableValueWithCallbacks<boolean>(() => false);
  const removed = useWritableValueWithCallbacks<boolean>(() => false);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const loginContext = useContext(LoginContext);

  const unsubscribe = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      unsubscribeByUID(saving, removed, error, sms?.uid, loginContext, e),
    [error, loginContext, removed, saving, sms]
  );

  useErrorModal(modals.modals, error, 'sms unsubscribe');

  if (sms === null) {
    return <div className={styles.sectionEmpty}>Not receiving any daily SMS notifications.</div>;
  }

  return (
    <UnsubscribeItem
      identifier={formatPhone(sms.phone)}
      saving={saving}
      removed={removed}
      unsubscribe={unsubscribe}
    />
  );
};

const formatPhone = (e164: string): string => {
  if (e164.startsWith('+1') && e164.length === 12) {
    return `+1 (${e164.substring(2, 5)}) ${e164.substring(5, 8)}-${e164.substring(8)}`;
  }

  return e164;
};

const UnsubscribeEmail = ({ email }: { email: DailyReminderEmailItem | null }): ReactElement => {
  const modals = useContext(ModalContext);
  const saving = useWritableValueWithCallbacks<boolean>(() => false);
  const removed = useWritableValueWithCallbacks<boolean>(() => false);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const loginContext = useContext(LoginContext);

  const unsubscribe = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      unsubscribeByUID(saving, removed, error, email?.uid, loginContext, e),
    [error, loginContext, removed, saving, email]
  );

  useErrorModal(modals.modals, error, 'email unsubscribe');

  if (email === null) {
    return <div className={styles.sectionEmpty}>Not receiving any daily email notifications.</div>;
  }

  return (
    <UnsubscribeItem
      identifier={email.email}
      saving={saving}
      removed={removed}
      unsubscribe={unsubscribe}
    />
  );
};

const UnsubscribePush = ({ push }: { push: DailyReminderPushItem | null }): ReactElement => {
  const modals = useContext(ModalContext);
  const saving = useWritableValueWithCallbacks<boolean>(() => false);
  const removed = useWritableValueWithCallbacks<boolean>(() => false);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const loginContext = useContext(LoginContext);

  const unsubscribe = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      unsubscribeByUID(saving, removed, error, push?.uid, loginContext, e),
    [error, loginContext, removed, saving, push]
  );

  useErrorModal(modals.modals, error, 'push unsubscribe');

  if (push === null) {
    return <div className={styles.sectionEmpty}>Not receiving any daily push notifications.</div>;
  }

  return (
    <>
      {push.devices.map((d) => (
        <UnsubscribeItem
          key={d.uid}
          identifier={
            <>
              {d.platform === 'android' ? 'Android' : d.platform === 'ios' ? 'iOS' : d.platform}{' '}
              <small>added {d.createdAt.toLocaleDateString()}</small>
            </>
          }
          saving={saving}
          removed={removed}
          unsubscribe={unsubscribe}
        />
      ))}
    </>
  );
};
