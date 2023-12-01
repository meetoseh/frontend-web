import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { FeatureComponentProps } from '../../../models/Feature';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import {
  ConfirmMergeAccountState,
  DailyReminderSettingsForConflict,
  EmailForConflict,
  OauthEmailConflictInfo,
  OauthPhoneConflictInfo,
  PhoneForConflict,
} from '../ConfirmMergeAccountState';
import { ConfirmMergeAccountWrapper } from './ConfirmMergeAccountWrapper';
import styles from './styles.module.css';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { Checkbox } from '../../../../../shared/forms/Checkbox';
import { Button } from '../../../../../shared/forms/Button';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { useErrorModal } from '../../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../../shared/contexts/ModalContext';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { describeError } from '../../../../../shared/forms/ErrorBlock';

export const ConfirmationRequired = ({
  resources,
  state,
}: FeatureComponentProps<ConfirmMergeAccountState, ConfirmMergeAccountResources>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContext = useContext(LoginContext);
  const phoneHintVWC = useWritableValueWithCallbacks<string | null>(() => null);
  const phoneErrorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  const emailHintVWC = useWritableValueWithCallbacks<string | null>(() => null);
  const emailErrorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  const closeDisabled = useWritableValueWithCallbacks<boolean>(() => false);
  const modalError = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const onMerge = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (closeDisabled.get()) {
        return;
      }
      const email = emailHintVWC.get();
      const phone = phoneHintVWC.get();

      const s = state.get();
      if (
        s.result === false ||
        s.result === null ||
        s.result === undefined ||
        s.result.result !== 'confirmationRequired' ||
        s.result.conflictDetails === null ||
        s.confirmResult !== null ||
        loginContext.state !== 'logged-in'
      ) {
        resources.get().session?.storeAction('confirm_start', {
          email,
          phone,
          error: "Invalid state for 'confirm_start' action",
        });
        setVWC(modalError, <>Contact support at hi@oseh.com for assistance</>);
        return;
      }

      if (s.result.conflictDetails.email !== null && email === null) {
        resources.get().session?.storeAction('confirm_start', {
          email,
          phone,
          error: 'Email conflict but no email selected',
        });
        setVWC(
          emailErrorVWC,
          'You must select one. You will be able to turn off email reminders after merging.'
        );
        return;
      }

      if (s.result.conflictDetails.phone !== null && phone === null) {
        resources.get().session?.storeAction('confirm_start', {
          email,
          phone,
          error: 'Phone conflict but no phone selected',
        });
        setVWC(
          phoneErrorVWC,
          'You must select one. You will be able to turn off SMS reminders after merging.'
        );
        return;
      }

      setVWC(modalError, null);
      resources.get().session?.storeAction('confirm_start', {
        email,
        phone,
        error: null,
      });
      s.onResolvingConflict();
      try {
        const response = await apiFetch(
          '/api/1/oauth/merge/confirm',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              merge_token: s.result.conflictDetails.mergeJwt,
              email_hint: email,
              phone_hint: phone,
            }),
          },
          loginContext
        );
        const status = response.status;
        resources.get().session?.storeAction('confirmed', {
          status,
        });

        if (status >= 200 && status < 300) {
          s.onResolveConflict(true, null);
        } else {
          s.onResolveConflict(false, await describeError(response));
        }
      } catch (e) {
        resources.get().session?.storeAction('confirmed', {
          error: `${e}`,
        });
        s.onResolveConflict(false, await describeError(e));
      }
    },
    [
      state,
      closeDisabled,
      modalError,
      loginContext,
      emailErrorVWC,
      phoneErrorVWC,
      resources,
      emailHintVWC,
      phoneHintVWC,
    ]
  );

  useErrorModal(modalContext.modals, modalError, 'confirm merge account');

  return (
    <ConfirmMergeAccountWrapper state={state} resources={resources} closeDisabled={closeDisabled}>
      <div className={styles.title}>Merge Accounts</div>
      <div className={styles.description}>
        To merge your two accounts please let us know where you would like to receive your daily
        reminders:
      </div>
      <RenderGuardedComponent
        props={useMappedValueWithCallbacks(state, (s) =>
          s.result === false ? undefined : s.result?.conflictDetails?.phone
        )}
        component={(conflict) =>
          conflict === null || conflict === undefined ? (
            <></>
          ) : (
            <ResolvePhoneConflict
              state={state}
              resources={resources}
              conflict={conflict}
              phoneHint={phoneHintVWC}
              error={phoneErrorVWC}
            />
          )
        }
      />
      <RenderGuardedComponent
        props={useMappedValueWithCallbacks(state, (s) =>
          s.result === false ? undefined : s.result?.conflictDetails?.email
        )}
        component={(conflict) =>
          conflict === null || conflict === undefined ? (
            <></>
          ) : (
            <ResolveEmailConflict
              state={state}
              resources={resources}
              conflict={conflict}
              emailHint={emailHintVWC}
              error={emailErrorVWC}
            />
          )
        }
      />
      <div className={styles.buttonContainer}>
        <RenderGuardedComponent
          props={closeDisabled}
          component={(disabled) => (
            <Button
              type="button"
              onClick={onMerge}
              disabled={disabled}
              spinner={disabled}
              variant="filled-white"
              fullWidth>
              Merge
            </Button>
          )}
        />
      </div>
    </ConfirmMergeAccountWrapper>
  );
};

function makePhoneConflictGeneric(v: PhoneForConflict): GenericForConflict {
  return {
    identifier: v.phoneNumber,
    formatted: ((pn) => {
      if (pn.length === 12 && pn[0] === '+' && pn[1] === '1') {
        return `+1 (${pn.slice(2, 5)}) ${pn.slice(5, 8)}-${pn.slice(8, 12)}`;
      }
      return pn;
    })(v.phoneNumber),
    suppressed: v.suppressed,
    verified: v.verified,
    enabled: v.enabled,
  };
}

const ResolvePhoneConflict = ({
  state,
  resources,
  conflict,
  phoneHint,
  error,
}: {
  state: ValueWithCallbacks<ConfirmMergeAccountState>;
  resources: ValueWithCallbacks<ConfirmMergeAccountResources>;
  conflict: OauthPhoneConflictInfo;
  phoneHint: WritableValueWithCallbacks<string | null>;
  error: WritableValueWithCallbacks<string | null>;
}): ReactElement => {
  return (
    <ResolveConflict
      state={state}
      resources={resources}
      conflict={{
        original: conflict.original.map(makePhoneConflictGeneric),
        merging: conflict.merging.map(makePhoneConflictGeneric),
        originalSettings: conflict.originalSettings,
        mergingSettings: conflict.mergingSettings,
      }}
      hint={phoneHint}
      error={error}
      conflictName="SMS"
    />
  );
};

function makeEmailConflictGeneric(v: EmailForConflict): GenericForConflict {
  return {
    identifier: v.emailAddress,
    formatted: v.emailAddress,
    suppressed: v.suppressed,
    verified: v.verified,
    enabled: v.enabled,
  };
}

const ResolveEmailConflict = ({
  state,
  resources,
  conflict,
  emailHint,
  error,
}: {
  state: ValueWithCallbacks<ConfirmMergeAccountState>;
  resources: ValueWithCallbacks<ConfirmMergeAccountResources>;
  conflict: OauthEmailConflictInfo;
  emailHint: WritableValueWithCallbacks<string | null>;
  error: WritableValueWithCallbacks<string | null>;
}): ReactElement => {
  return (
    <ResolveConflict
      state={state}
      resources={resources}
      conflict={{
        original: conflict.original.map(makeEmailConflictGeneric),
        merging: conflict.merging.map(makeEmailConflictGeneric),
        originalSettings: conflict.originalSettings,
        mergingSettings: conflict.mergingSettings,
      }}
      hint={emailHint}
      error={error}
      conflictName="Email"
    />
  );
};

type GenericForConflict = {
  identifier: string;
  formatted: string;
  suppressed: boolean;
  verified: boolean;
  enabled: boolean;
};

type GenericConflictInfo = {
  original: GenericForConflict[];
  merging: GenericForConflict[];
  originalSettings: DailyReminderSettingsForConflict;
  mergingSettings: DailyReminderSettingsForConflict;
};

const ResolveConflict = ({
  state,
  resources,
  conflict,
  hint,
  conflictName,
  error,
}: {
  state: ValueWithCallbacks<ConfirmMergeAccountState>;
  resources: ValueWithCallbacks<ConfirmMergeAccountResources>;
  conflict: GenericConflictInfo;
  hint: WritableValueWithCallbacks<string | null>;
  conflictName: string;
  error: WritableValueWithCallbacks<string | null>;
}): ReactElement => {
  const options: Pick<GenericForConflict, 'identifier' | 'formatted'>[] = useMemo(() => {
    const seenIdentifiers = new Set<string>();
    const result: Pick<GenericForConflict, 'identifier' | 'formatted'>[] = [];
    for (const c of conflict.original) {
      if (!c.suppressed && c.verified && c.enabled && !seenIdentifiers.has(c.identifier)) {
        seenIdentifiers.add(c.identifier);
        result.push({ identifier: c.identifier, formatted: c.formatted });
      }
    }
    for (const c of conflict.merging) {
      if (!c.suppressed && c.verified && c.enabled && !seenIdentifiers.has(c.identifier)) {
        seenIdentifiers.add(c.identifier);
        result.push({ identifier: c.identifier, formatted: c.formatted });
      }
    }
    return result;
  }, [conflict]);

  return (
    <div className={styles.resolveConflict}>
      <div className={styles.resolveConflictTitle}>{conflictName} Reminders:</div>
      <div className={styles.resolveConflictOptions}>
        <RenderGuardedComponent
          props={hint}
          component={(checkedIdentifier) => (
            <>
              {options.map((o, idx) => (
                <div key={idx} className={styles.resolveConflictOption}>
                  <Checkbox
                    value={checkedIdentifier === o.identifier}
                    label={o.formatted}
                    setValue={(v) => {
                      if (v) {
                        setVWC(hint, o.identifier);
                        setVWC(error, null);
                      }
                    }}
                    checkboxStyle="whiteWide"
                  />
                </div>
              ))}
            </>
          )}
        />
      </div>
      <RenderGuardedComponent
        props={error}
        component={(error) => (
          <>{error && <div className={styles.resolveConflictError}>{error}</div>}</>
        )}
      />
    </div>
  );
};
