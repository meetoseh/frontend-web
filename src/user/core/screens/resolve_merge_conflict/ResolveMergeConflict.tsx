import { ReactElement, useContext, useEffect, useMemo } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './ResolveMergeConflict.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  Callbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { ResolveMergeConflictResources } from './ResolveMergeConflictResources';
import {
  DailyReminderSettingsForConflict,
  EmailForConflict,
  OauthEmailConflictInfo,
  OauthPhoneConflictInfo,
  PhoneForConflict,
  ResolveMergeConflictMappedParams,
} from './ResolveMergeConflictParams';
import { getJwtExpiration } from '../../../../shared/lib/getJwtExpiration';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { SurveyCheckboxGroup } from '../../../../shared/components/SurveyCheckboxGroup';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

const TEST_MERGE_JWT = 'token';

/**
 * Allows the user to resolve a merge conflict.
 */
export const ResolveMergeConflict = ({
  ctx,
  screen,
  trace,
  startPop,
}: ScreenComponentProps<
  'resolve_merge_conflict',
  ResolveMergeConflictResources,
  ResolveMergeConflictMappedParams
>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  useEffect(() => {
    const jwt = screen.parameters.conflict.mergeJwt;
    if (jwt === TEST_MERGE_JWT) {
      return;
    }

    let active = true;
    let timeout: NodeJS.Timeout | null = null;
    initTimeout();
    return () => {
      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    async function initTimeout() {
      if (!active) {
        return;
      }

      let expiresAt: number;
      try {
        expiresAt = getJwtExpiration(jwt);
      } catch (e) {
        console.warn(`Ignoring merge jwt expiration: ${e}`);
        return;
      }

      const mountedAt = await getCurrentServerTimeMS();
      if (!active) {
        return;
      }

      const timeToExpire = expiresAt - mountedAt;
      if (timeToExpire < 0) {
        trace({ type: 'expired', expiresAt, mountedAt, timeToExpire, resolves: 'instantly' });
        configurableScreenOut(
          workingVWC,
          startPop,
          transition,
          { type: 'fade', ms: 350 },
          screen.parameters.expired.trigger
        );
        return;
      }

      timeout = setTimeout(() => {
        timeout = null;
        trace({ type: 'expired', expiresAt, mountedAt, timeToExpire, resolves: 'timeout' });
        configurableScreenOut(
          workingVWC,
          startPop,
          transition,
          { type: 'fade', ms: 350 },
          screen.parameters.expired.trigger
        );
      }, timeToExpire);
    }
  }, [
    screen.parameters.conflict.mergeJwt,
    screen.parameters.expired.trigger,
    startPop,
    trace,
    transition,
    workingVWC,
  ]);

  const emailHintVWC = useWritableValueWithCallbacks<string | null>(
    () => screen.parameters.conflict.email?.original?.[0]?.emailAddress ?? null
  );
  const phoneHintVWC = useWritableValueWithCallbacks<string | null>(
    () => screen.parameters.conflict.phone?.original?.[0]?.phoneNumber ?? null
  );
  const readyVWC = useMappedValuesWithCallbacks(
    [emailHintVWC, phoneHintVWC],
    () =>
      (screen.parameters.conflict.email === null || emailHintVWC.get() !== null) &&
      (screen.parameters.conflict.phone === null || phoneHintVWC.get() !== null)
  );

  const mergeErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const seenErrorVWC = useWritableValueWithCallbacks<boolean>(() => false);
  useValueWithCallbacksEffect(mergeErrorVWC, (v) => {
    if (v !== null) {
      setVWC(seenErrorVWC, true);
    }
    return undefined;
  });

  useErrorModal(modalContext.modals, mergeErrorVWC, 'merging');

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.header}>{screen.parameters.header}</div>
        {screen.parameters.message !== null && (
          <>
            <VerticalSpacer height={16} />
            <div className={styles.message}>{screen.parameters.message}</div>
          </>
        )}
        {screen.parameters.conflict.email !== null && (
          <>
            <VerticalSpacer height={24} />
            <ResolveEmailConflict
              conflict={screen.parameters.conflict.email}
              emailHint={emailHintVWC}
            />
          </>
        )}
        {screen.parameters.conflict.phone !== null && (
          <>
            <VerticalSpacer height={24} />
            <ResolvePhoneConflict
              conflict={screen.parameters.conflict.phone}
              phoneHint={phoneHintVWC}
            />
          </>
        )}

        <VerticalSpacer height={0} flexGrow={1} />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks([readyVWC, workingVWC], () => ({
            disabled: !readyVWC.get(),
            spinner: workingVWC.get(),
          }))}
          component={({ disabled, spinner }) => (
            <Button
              type="button"
              variant="filled-white"
              onClick={async (e) => {
                e.preventDefault();

                const emailHint = emailHintVWC.get();
                const phoneHint = phoneHintVWC.get();
                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.cta.exit,
                  screen.parameters.cta.trigger,
                  {
                    endpoint: '/api/1/users/me/screens/empty_with_confirm_merge',
                    parameters: {
                      merge_token: screen.parameters.conflict.mergeJwt,
                      email_hint: emailHint,
                      phone_hint: phoneHint,
                    },
                    beforeDone: async () => {
                      trace({
                        type: 'cta',
                        emailHint,
                        phoneHint,
                        step: 'before-done',
                      });
                    },
                    afterDone: async () => {
                      trace({
                        type: 'cta',
                        emailHint,
                        phoneHint,
                        step: 'after-done',
                      });
                    },
                    onError: async (error) => {
                      trace({
                        type: 'cta',
                        emailHint,
                        phoneHint,
                        step: 'error',
                        error: `${error}`,
                      });
                      setVWC(mergeErrorVWC, await describeError(error));
                    },
                  }
                );
              }}
              disabled={disabled}
              spinner={spinner}>
              {screen.parameters.cta.text}
            </Button>
          )}
        />
        <RenderGuardedComponent
          props={seenErrorVWC}
          component={(skippable) =>
            !skippable ? (
              <></>
            ) : (
              <>
                <VerticalSpacer height={16} />
                <Button
                  type="button"
                  variant="outlined-white"
                  onClick={() => {
                    configurableScreenOut(
                      workingVWC,
                      startPop,
                      transition,
                      screen.parameters.skip.exit,
                      screen.parameters.skip.trigger,
                      {
                        beforeDone: async () => {
                          trace({ type: 'skip' });
                        },
                      }
                    );
                  }}>
                  {screen.parameters.skip.text}
                </Button>
              </>
            )
          }
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
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
  conflict,
  phoneHint,
}: {
  conflict: OauthPhoneConflictInfo;
  phoneHint: WritableValueWithCallbacks<string | null>;
}): ReactElement => {
  return (
    <ResolveConflict
      conflict={{
        original: conflict.original.map(makePhoneConflictGeneric),
        merging: conflict.merging.map(makePhoneConflictGeneric),
        originalSettings: conflict.originalSettings,
        mergingSettings: conflict.mergingSettings,
      }}
      hint={phoneHint}
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
  conflict,
  emailHint,
}: {
  conflict: OauthEmailConflictInfo;
  emailHint: WritableValueWithCallbacks<string | null>;
}): ReactElement => {
  return (
    <ResolveConflict
      conflict={{
        original: conflict.original.map(makeEmailConflictGeneric),
        merging: conflict.merging.map(makeEmailConflictGeneric),
        originalSettings: conflict.originalSettings,
        mergingSettings: conflict.mergingSettings,
      }}
      hint={emailHint}
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
  conflict,
  hint,
  conflictName,
}: {
  conflict: GenericConflictInfo;
  hint: WritableValueWithCallbacks<string | null>;
  conflictName: string;
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
    <>
      <div className={styles.sectionTitle}>{conflictName} Reminders</div>
      <VerticalSpacer height={8} />
      <SurveyCheckboxGroup
        choices={options.map((o) => ({
          slug: o.identifier,
          element: <>{o.formatted}</>,
        }))}
        variant="round"
        checked={{
          get: () => {
            const v = hint.get();
            if (v === null) {
              return [];
            }
            return [v];
          },
          set: (values) => {
            if (values.length === 0) {
              setVWC(hint, null);
            } else {
              setVWC(hint, values[0]);
            }
          },
          callbacks: hint.callbacks as Callbacks<
            { action: 'checked' | 'unchecked'; changed: string } | undefined
          >,
        }}
      />
    </>
  );
};
