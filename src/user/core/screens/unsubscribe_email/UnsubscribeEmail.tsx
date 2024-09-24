import { ReactElement, useEffect } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './UnsubscribeEmail.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { UnsubscribeEmailResources } from './UnsubscribeEmailResources';
import { UnsubscribeEmailParamsMapped } from './UnsubscribeEmailParams';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { ContentContainer } from '../../../../shared/components/ContentContainer';

/**
 * A basic screen with a text input for an email address that unsubscribes
 * that email address from reminders, without them necessarily knowing how
 * to login to that account.
 */
export const UnsubscribeEmail = ({
  ctx,
  screen,
  startPop,
  trace,
}: ScreenComponentProps<
  'unsubscribe_email',
  UnsubscribeEmailResources,
  UnsubscribeEmailParamsMapped
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (size) => size.width);

  const emailVWC = useWritableValueWithCallbacks<string>(() => '');
  const emailIsValidVWC = useMappedValueWithCallbacks(emailVWC, (email) => email.indexOf('@') >= 0);

  const onSubmit = () => {
    configurableScreenOut(
      workingVWC,
      startPop,
      transition,
      screen.parameters.cta.exit,
      screen.parameters.cta.trigger,
      {
        parameters: { email: emailVWC.get(), code: screen.parameters.code },
        afterDone: () => {
          trace({ type: 'cta', email: emailVWC.get() });
        },
      }
    );
  };

  useEffect(() => {
    if (screen.parameters.code === null) {
      configurableScreenOut(
        workingVWC,
        startPop,
        transition,
        { type: 'none', ms: 0 },
        { type: 'pop', endpoint: null },
        {
          afterDone: () => {
            trace({ type: 'skip', reason: 'no code' });
          },
        }
      );
    }
  });

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <ScreenHeader
          close={{
            variant: screen.parameters.close.variant,
            onClick: (e) => {
              e.preventDefault();
              configurableScreenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.close.exit,
                screen.parameters.close.trigger,
                {
                  afterDone: () => {
                    trace({ type: 'close' });
                  },
                }
              );
            },
          }}
          text={screen.parameters.header}
          windowWidth={windowWidthVWC}
          contentWidth={ctx.contentWidth}
        />
        <VerticalSpacer height={0} flexGrow={1} />
        {screen.parameters.title !== null && (
          <ContentContainer contentWidthVWC={ctx.contentWidth}>
            <div className={styles.title}>{screen.parameters.title}</div>
          </ContentContainer>
        )}
        {screen.parameters.title !== null && screen.parameters.body !== null && (
          <VerticalSpacer height={12} />
        )}
        {screen.parameters.body !== null && (
          <ContentContainer contentWidthVWC={ctx.contentWidth}>
            <div className={styles.body}>{screen.parameters.body}</div>
          </ContentContainer>
        )}
        {(screen.parameters.title !== null || screen.parameters.body !== null) && (
          <VerticalSpacer height={32} />
        )}
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <RenderGuardedComponent
            props={useMappedValuesWithCallbacks([emailVWC, workingVWC], () => ({
              email: emailVWC.get(),
              working: workingVWC.get(),
            }))}
            component={({ email, working }) => (
              <form
                className={styles.column}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!working) {
                    onSubmit();
                  }
                }}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={screen.parameters.placeholder}
                  value={email}
                  onChange={(e) => setVWC(emailVWC, e.target.value)}
                  disabled={working}
                />
                <button
                  className={assistiveStyles.srOnly}
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!working) {
                      onSubmit();
                    }
                  }}
                  disabled={working}>
                  {screen.parameters.cta.text}
                </button>
              </form>
            )}
            applyInstantly
          />
          {screen.parameters.help !== null && (
            <>
              <VerticalSpacer height={12} />
              <div className={styles.help}>{screen.parameters.help}</div>
            </>
          )}
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <RenderGuardedComponent
            props={emailIsValidVWC}
            component={(valid) => (
              <Button
                type="button"
                variant="filled-white"
                disabled={!valid}
                onClick={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}>
                {screen.parameters.cta.text}
              </Button>
            )}
          />
        </ContentContainer>
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
