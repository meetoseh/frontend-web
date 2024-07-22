import { ReactElement, useContext, useEffect } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { FeedbackMappedParams } from './FeedbackParams';
import { FeedbackResources } from './FeedbackResources';
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
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import styles from './Feedback.module.css';
import { Close } from '../interactive_prompt_screen/icons/Close';
import { IconButton } from '../../../../shared/forms/IconButton';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { Button } from '../../../../shared/forms/Button';
import { Checkbox } from '../../../../shared/forms/Checkbox';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { adaptValueWithCallbacksAsSetState } from '../../../../shared/lib/adaptValueWithCallbacksAsSetState';
import { showYesNoModal } from '../../../../shared/lib/showYesNoModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { ContentContainer } from '../../../../shared/components/ContentContainer';

/**
 * Presents the user the opportunity to give some free-form feedback
 */
export const Feedback = ({
  ctx,
  screen,
  startPop,
  trace,
}: ScreenComponentProps<'feedback', FeedbackResources, FeedbackMappedParams>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const inputVWC = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  const rawInputValueVWC = useWritableValueWithCallbacks<string>(() => '');

  const anonymousVWC = useWritableValueWithCallbacks(() => true);
  useEffect(() => {
    setVWC(anonymousVWC, initialValue());

    function initialValue() {
      if (screen.parameters.anonymous === 'opt-in') {
        return false;
      } else if (screen.parameters.anonymous === 'opt-out') {
        return true;
      } else if (screen.parameters.anonymous === 'require') {
        return true;
      } else if (screen.parameters.anonymous === 'forbid') {
        return false;
      } else {
        trace({ type: 'error', message: 'unknown anonymous parameter, initializing to true' });
        return true;
      }
    }
  }, [screen.parameters.anonymous]);

  const disabledVWC = useMappedValueWithCallbacks(rawInputValueVWC, (v) => v.trim() === '');
  const submitErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, submitErrorVWC, 'saving feedback');

  const onSubmit = async () => {
    if (disabledVWC.get()) {
      return;
    }

    screenWithWorking(workingVWC, async () => {
      const ele = inputVWC.get();
      if (ele === null) {
        return;
      }

      const anonymous = anonymousVWC.get();
      trace({
        type: 'submit',
        anonymous,
      });

      const loginContextUnch = ctx.login.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        trace({ type: 'submit-error', details: 'not logged in' });
        setVWC(submitErrorVWC, <>Not logged in</>);
        return;
      }
      const loginContext = loginContextUnch;

      setVWC(submitErrorVWC, null);

      setVWC(transition.animation, screen.parameters.exit);
      const exitTransitionCancelable = playExitTransition(transition);

      try {
        const response = await apiFetch(
          '/api/1/general_feedback/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              anonymous: anonymousVWC.get(),
              feedback: ele.value,
              slug: screen.parameters.slug,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        trace({ type: 'submit-success' });
        const trigger = screen.parameters.trigger;
        const finishPop = startPop(
          trigger === null
            ? null
            : {
                slug: trigger,
                parameters: {},
              }
        );
        await exitTransitionCancelable.promise;
        finishPop();
      } catch (e) {
        trace({ type: 'submit-error', details: `${e}` });
        const desc = await describeError(e);
        setVWC(submitErrorVWC, desc);
        await exitTransitionCancelable.promise;
        playEntranceTransition(transition);
        return;
      }
    });
  };

  const fixInput = () => {
    const input = inputVWC.get();
    if (input === null) {
      return;
    }
    input.style.height = '5px';
    input.style.height = `${input.scrollHeight}px`;
  };
  useValueWithCallbacksEffect(inputVWC, (eleRaw) => {
    if (eleRaw === null) {
      return undefined;
    }
    const ele = eleRaw;
    ele.addEventListener('input', onInputOrChange);
    ele.addEventListener('change', onInputOrChange);
    ele.addEventListener('keydown', onKeydown);
    return () => {
      ele.removeEventListener('input', onInputOrChange);
      ele.removeEventListener('change', onInputOrChange);
      ele.removeEventListener('keydown', onKeydown);
    };

    function onInputOrChange() {
      setVWC(rawInputValueVWC, ele.value);
      fixInput();
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    }
  });
  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={useMappedValueWithCallbacks(ctx.windowSizeImmediate, (v) => v.width)}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <div className={styles.close}>
          <IconButton
            icon={<Close />}
            srOnlyName="Close"
            onClick={(e) => {
              e.preventDefault();
              screenWithWorking(workingVWC, async () => {
                const ele = inputVWC.get();
                if (ele === null) {
                  return;
                }

                if (ele.value.trim() === '') {
                  trace({ type: 'close', details: 'nothing-written' });
                  screenOut(
                    null,
                    startPop,
                    transition,
                    screen.parameters.exit,
                    screen.parameters.close
                  );
                  return;
                }

                trace({ type: 'close', details: 'confirming' });
                const confirmation = await showYesNoModal(modalContext.modals, {
                  title: 'Discard feedback?',
                  body: 'What you have written will not be saved.',
                  cta1: 'Discard',
                  emphasize: 1,
                }).promise;
                if (!confirmation) {
                  trace({ type: 'close', details: 'cancel' });
                  return;
                }
                trace({ type: 'close', details: 'confirmed-discard' });
                screenOut(
                  null,
                  startPop,
                  transition,
                  screen.parameters.exit,
                  screen.parameters.close
                );
              });
            }}
          />
        </div>
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.top}>{screen.parameters.top}</div>
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.header}>{screen.parameters.header}</div>
        </ContentContainer>
        <VerticalSpacer height={0} maxHeight={16} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.message}>{screen.parameters.message}</div>
        </ContentContainer>
        <VerticalSpacer height={0} maxHeight={24} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}>
            <textarea
              className={styles.input}
              rows={1}
              placeholder={screen.parameters.placeholder}
              ref={(r) => setVWC(inputVWC, r)}
            />
            <RenderGuardedComponent
              props={disabledVWC}
              component={(disabled) => (
                <button
                  type="submit"
                  className={assistiveStyles.srOnly}
                  disabled={disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    onSubmit();
                  }}>
                  Submit
                </button>
              )}
            />
          </form>
        </ContentContainer>
        {screen.parameters.details !== null && (
          <>
            <VerticalSpacer height={0} maxHeight={32} flexGrow={1} />
            <ContentContainer contentWidthVWC={ctx.contentWidth}>
              <div className={styles.details}>{screen.parameters.details}</div>
            </ContentContainer>
          </>
        )}
        {screen.parameters.anonymous === 'opt-in' || screen.parameters.anonymous === 'opt-out' ? (
          <>
            <VerticalSpacer height={0} maxHeight={16} flexGrow={1} />
            <ContentContainer contentWidthVWC={ctx.contentWidth}>
              <RenderGuardedComponent
                props={anonymousVWC}
                component={(checked) => (
                  <Checkbox
                    value={checked}
                    setValue={adaptValueWithCallbacksAsSetState(anonymousVWC)}
                    checkboxStyle="white"
                    label={screen.parameters.anonymousLabel}
                  />
                )}
              />
            </ContentContainer>
          </>
        ) : undefined}
        <VerticalSpacer height={0} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <RenderGuardedComponent
            props={disabledVWC}
            component={(disabled) => (
              <Button
                type="button"
                variant="filled-white"
                onClick={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
                disabled={disabled}>
                {screen.parameters.cta}
              </Button>
            )}
          />
        </ContentContainer>
        {screen.parameters.cta2 !== null && (
          <>
            <VerticalSpacer height={0} maxHeight={8} flexGrow={1} />
            <ContentContainer contentWidthVWC={ctx.contentWidth}>
              <Button
                type="button"
                variant="link-white"
                onClick={(e) => {
                  e.preventDefault();

                  screenWithWorking(workingVWC, async () => {
                    if (screen.parameters.cta2 === null) {
                      return;
                    }

                    const ele = inputVWC.get();
                    if (ele === null) {
                      return;
                    }

                    if (ele.value.trim() === '') {
                      trace({ type: 'cta2', details: 'nothing-written' });
                      screenOut(
                        null,
                        startPop,
                        transition,
                        screen.parameters.exit,
                        screen.parameters.cta2.trigger
                      );
                      return;
                    }

                    trace({ type: 'cta2', details: 'confirming' });
                    const confirmation = await showYesNoModal(modalContext.modals, {
                      title: 'Discard feedback?',
                      body: 'What you have written will not be saved.',
                      cta1: 'Discard',
                      emphasize: 1,
                    }).promise;
                    if (!confirmation) {
                      trace({ type: 'cta2', details: 'cancel' });
                      return;
                    }
                    trace({ type: 'cta2', details: 'confirmed-discard' });
                    screenOut(
                      null,
                      startPop,
                      transition,
                      screen.parameters.exit,
                      screen.parameters.cta2.trigger
                    );
                  });
                }}>
                {screen.parameters.cta2.text}
              </Button>
            </ContentContainer>
          </>
        )}
        <VerticalSpacer height={0} maxHeight={24} flexGrow={1} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
