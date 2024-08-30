import { ReactElement, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './VerifyPhone.module.css';
import {
  playEntranceTransition,
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { VerifyPhoneResources } from './VerifyPhoneResources';
import { VerifyPhoneMappedParams } from './VerifyPhoneParams';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { TextInput } from '../../../../shared/forms/TextInput';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { BackContinue } from '../../../../shared/components/BackContinue';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { apiFetch } from '../../../../shared/ApiConstants';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { useBeforeTime } from '../../../../shared/hooks/useBeforeTime';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { AutoBold } from '../../../../shared/components/AutoBold';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { adaptExitTransition } from '../../lib/adaptExitTransition';

/**
 * Allows the user to verify a phone; triggers the back flow if the
 * code expires
 */
export const VerifyPhone = ({
  ctx,
  screen,
  trace,
  startPop,
}: ScreenComponentProps<
  'verify_phone',
  VerifyPhoneResources,
  VerifyPhoneMappedParams
>): ReactElement => {
  const modalContext = useContext(ModalContext);

  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const codeVWC = useWritableValueWithCallbacks(() => '');
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const handleContinue = () =>
    screenWithWorking(workingVWC, async () => {
      if (codeVWC.get().length === 0) {
        return;
      }

      const loginContext = ctx.login.value.get();
      if (loginContext.state !== 'logged-in') {
        setVWC(errorVWC, <>Not logged in</>);
        return;
      }

      setVWC(errorVWC, null);

      setVWC(transition.animation, await adaptExitTransition(screen.parameters.cta.exit));
      const exitTransition = playExitTransition(transition);

      const code = codeVWC.get();
      trace({ type: 'verify', codeLength: code.length, step: 'start' });
      try {
        const response = await apiFetch(
          '/api/1/phones/verify/finish',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              uid: screen.parameters.verification.uid,
              code,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
      } catch (e) {
        trace({ type: 'verify', step: 'error', error: `${e}` });
        setVWC(errorVWC, await describeError(e));
        await exitTransition.promise;
        await playEntranceTransition(transition).promise;
        return;
      }

      trace({ type: 'verify', step: 'success' });
      ctx.resources.reminderChannelsHandler.evictOrReplace(loginContext, (old) => {
        if (old === undefined) {
          return { type: 'make-request', data: undefined };
        }

        if (old.potentialChannels.has('sms')) {
          return { type: 'data', data: old };
        }

        // we can't know if it's unconfigured
        return { type: 'make-request', data: undefined };
      });
      const trigger = screen.parameters.cta.trigger;
      const finishPop = startPop(
        trigger.type === 'pop'
          ? null
          : {
              slug: trigger.flow,
              parameters: trigger.parameters,
            },
        trigger.endpoint ?? undefined
      );
      await exitTransition.promise;
      finishPop();
    });

  const isVerificationUnexpiredVWC = useBeforeTime({
    type: 'react-rerender',
    props: screen.parameters.verification.expiresAt.getTime(),
  });

  useValueWithCallbacksEffect(isVerificationUnexpiredVWC, (isUnexpired) => {
    if (isUnexpired) {
      return undefined;
    }

    trace({ type: 'expired' });
    configurableScreenOut(
      workingVWC,
      startPop,
      transition,
      screen.parameters.back.exit,
      screen.parameters.back.trigger
    );
    return undefined;
  });

  useErrorModal(modalContext.modals, errorVWC, 'verifying code');

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
        <VerticalSpacer height={16} />
        <AutoBold className={styles.message} message={screen.parameters.message} />
        <VerticalSpacer height={32} />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks([codeVWC, workingVWC], () => ({
            code: codeVWC.get(),
            disabled: workingVWC.get(),
          }))}
          component={({ code, disabled }) => (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                handleContinue();
              }}>
              <TextInput
                type="text"
                value={code}
                onChange={(v) => setVWC(codeVWC, v)}
                disabled={disabled}
                html5Validation={{
                  required: true,
                  minLength: 5,
                  maxLength: 9,
                  pattern: '[0-9]*',
                }}
                label="Code"
                help={null}
                inputStyle="white"
              />
              <button
                type="submit"
                className={assistiveStyles.srOnly}
                onClick={(e) => {
                  e.preventDefault();
                  handleContinue();
                }}>
                Submit
              </button>
            </form>
          )}
          applyInstantly
        />
        <VerticalSpacer height={0} flexGrow={1} />
        <BackContinue
          onBack={() => {
            configurableScreenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.back.exit,
              screen.parameters.back.trigger
            );
          }}
          onContinue={handleContinue}
          backText={screen.parameters.back.text}
          continueText={screen.parameters.cta.text}
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
