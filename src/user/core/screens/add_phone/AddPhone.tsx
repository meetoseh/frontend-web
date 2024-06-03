import { Fragment, ReactElement, useCallback, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import {
  GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT,
  GRID_SIMPLE_NAVIGATION_FOREGROUND_TOP_HEIGHT,
  GridSimpleNavigationForeground,
} from '../../../../shared/components/GridSimpleNavigationForeground';
import { AddPhoneResources } from './AddPhoneResources';
import { AddPhoneMappedParams } from './AddPhoneParams';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import Messages from './icons/Messages';
import styles from './AddPhone.module.css';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../../../shared/forms/TextInput';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { screenOut } from '../../lib/screenOut';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { Button } from '../../../../shared/forms/Button';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useTimezone } from '../../../../shared/hooks/useTimezone';

/**
 * Allows the user to add a phone number; they need to verify the phone number
 * by entering a code that we send to them. Verification is performed on the next
 * screen, but sending the code occurs when they click the button.
 */
export const AddPhone = ({
  ctx,
  screen,
  startPop,
  trace,
}: ScreenComponentProps<'add_phone', AddPhoneResources, AddPhoneMappedParams>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const phoneVWC = useWritableValueWithCallbacks(() => '');
  const errorPhoneVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const formatAndSetPhone = useCallback(
    async (newValue: string) => {
      setVWC(errorPhoneVWC, false);

      if (newValue === '+') {
        setVWC(phoneVWC, '+');
        return;
      }

      if (newValue[0] === '+' && newValue[1] !== '1') {
        // international number; we'll just let them type it
        setVWC(phoneVWC, newValue);
        return;
      }

      let stripped = newValue.replace(/[^0-9]/g, '');

      if (newValue.endsWith('-')) {
        // they backspaced a space
        stripped = stripped.slice(0, -1);
      }

      if (stripped.length === 0) {
        setVWC(phoneVWC, '');
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

      setVWC(phoneVWC, result);
    },
    [phoneVWC, errorPhoneVWC]
  );
  const phoneFormatCorrect = useMappedValueWithCallbacks(phoneVWC, (phone) => {
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

  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, errorVWC, 'sending code to phone');

  const timezone = useTimezone();

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        {screen.parameters.nav.type === 'nav' && (
          <VerticalSpacer height={GRID_SIMPLE_NAVIGATION_FOREGROUND_TOP_HEIGHT} />
        )}
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.messages}>
          <Messages width={111} height={111} />
        </div>
        <VerticalSpacer height={24} />
        <div className={styles.header}>{screen.parameters.header}</div>
        <VerticalSpacer height={16} />
        <div className={styles.message}>{screen.parameters.message}</div>
        <VerticalSpacer height={0} flexGrow={1} />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks([phoneVWC, errorPhoneVWC, workingVWC], () => ({
            phone: phoneVWC.get(),
            error: errorPhoneVWC.get(),
            disabled: workingVWC.get(),
          }))}
          component={({ phone, error, disabled }) => (
            <TextInput
              type="tel"
              label="Phone Number"
              value={phone}
              inputStyle={error ? 'error-white' : 'white'}
              onChange={formatAndSetPhone}
              html5Validation={null}
              disabled={disabled}
              help={null}
            />
          )}
          applyInstantly
        />
        <VerticalSpacer height={0} flexGrow={1} />
        <Button
          type="button"
          variant="filled-white"
          onClick={(e) => {
            e.preventDefault();
            if (!phoneFormatCorrect.get()) {
              setVWC(errorPhoneVWC, true);
              return;
            }

            screenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.cta.exit,
              screen.parameters.cta.trigger,
              {
                endpoint: '/api/1/users/me/screens/pop_to_phone_verify',
                parameters: {
                  phone_number: phoneVWC.get(),
                  receive_notifications: screen.parameters.reminders,
                  timezone,
                  timezone_technique: 'browser',
                },
                onError: async (err) => {
                  const described = await describeError(err);
                  setVWC(errorVWC, described);
                },
              }
            );
          }}>
          {screen.parameters.cta.text}
        </Button>
        {screen.parameters.nav.type === 'no-nav' && (
          <>
            <VerticalSpacer height={16} />
            <Button
              type="button"
              variant="link-white"
              onClick={(e) => {
                e.preventDefault();
                screenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.back.exit,
                  screen.parameters.back.trigger
                );
              }}>
              {screen.parameters.nav.back}
            </Button>
          </>
        )}
        {screen.parameters.legal !== null && (
          <>
            <VerticalSpacer height={16} />
            <div className={styles.legal}>
              {((fmt) => {
                const result: ReactElement[] = [];

                const nextLiteralRegex = /\[([^\]]+)\]/g;

                let handledUpTo = 0;
                while (true) {
                  const match = nextLiteralRegex.exec(fmt);
                  if (match === null) {
                    result.push(<Fragment key={result.length}>{fmt.slice(handledUpTo)}</Fragment>);
                    break;
                  }

                  const literal = match[1];

                  if (match.index > handledUpTo) {
                    result.push(
                      <Fragment key={result.length}>{fmt.slice(handledUpTo, match.index)}</Fragment>
                    );
                  }

                  if (literal === 'Terms') {
                    result.push(
                      <a
                        key={result.length}
                        href="https://www.oseh.com/terms"
                        target="_blank"
                        rel="noopener noreferrer">
                        {literal}
                      </a>
                    );
                  } else if (literal === 'Privacy Policy') {
                    result.push(
                      <a
                        key={result.length}
                        href="https://www.oseh.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer">
                        {literal}
                      </a>
                    );
                  } else {
                    result.push(<Fragment key={result.length}>{literal}</Fragment>);
                  }
                  handledUpTo = match.index + match[0].length;
                }

                return <>{result}</>;
              })(screen.parameters.legal)}
            </div>
          </>
        )}
        <VerticalSpacer height={32} />
        {screen.parameters.nav.type === 'nav' && (
          <VerticalSpacer height={GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT} />
        )}
      </GridContentContainer>
      {screen.parameters.nav.type === 'nav' && (
        <GridSimpleNavigationForeground
          workingVWC={workingVWC}
          startPop={startPop}
          gridSize={ctx.windowSizeImmediate}
          transitionState={transitionState}
          transition={transition}
          trace={trace}
          back={screen.parameters.back}
          home={{ trigger: screen.parameters.nav.home.trigger, exit: { type: 'fade', ms: 350 } }}
          series={{
            trigger: screen.parameters.nav.series.trigger,
            exit: { type: 'fade', ms: 350 },
          }}
          account={null}
          title={screen.parameters.nav.title}
        />
      )}
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
