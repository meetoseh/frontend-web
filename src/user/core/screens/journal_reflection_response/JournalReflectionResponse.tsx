import { Fragment, ReactElement, useContext, useEffect } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
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
import { Callbacks, useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';
import styles from './JournalReflectionResponse.module.css';
import { Button } from '../../../../shared/forms/Button';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { JournalReflectionResponseResources } from './JournalReflectionResponseResources';
import { JourneyReflectionResponseMappedParams } from './JournalReflectionResponseParams';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { Forward } from '../../../../shared/components/icons/Forward';
import { OsehColors } from '../../../../shared/OsehColors';
import { setVWC } from '../../../../shared/lib/setVWC';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import {
  FlexGrowContentWidthTextArea,
  FlexGrowContentWidthTextAreaProps,
} from '../../../../shared/components/FlexGrowContentWidthTextArea';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { adaptExitTransition } from '../../lib/adaptExitTransition';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * Shows the journal reflection question and gives a large amount of room for
 * the user to write their response.
 */
export const JournalReflectionResponse = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'journal_reflection_response',
  JournalReflectionResponseResources,
  JourneyReflectionResponseMappedParams
>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const isErrorVWC = useMappedValueWithCallbacks(resources.question, (q) => q === undefined);
  useValueWithCallbacksEffect(isErrorVWC, (isError) => {
    if (isError) {
      trace({ type: 'error', hint: 'question is undefined' });
    }
    return undefined;
  });

  const isReadyToContinueVWC = useMappedValuesWithCallbacks(
    [resources.question, resources.response],
    () => {
      const q = resources.question.get();
      const r = resources.response.get();
      return q !== null && q !== undefined && r.type === 'available';
    }
  );
  useValueWithCallbacksEffect(isReadyToContinueVWC, (isReady) => {
    if (isReady) {
      trace({ type: 'ready' });
    }
    return undefined;
  });

  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (size) => size.width);

  const inputVWC = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useValueWithCallbacksEffect(inputVWC, (i) => {
    i?.focus();
    return undefined;
  });
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, errorVWC, 'saving response');

  const responseWrappedVWC = useWritableValueWithCallbacks<
    FlexGrowContentWidthTextAreaProps['value'] | null
  >(() => null);
  useEffect(() => {
    let currentV = getValue();
    const callbacks = new Callbacks<{ updateInput: boolean } | undefined>();

    const cleanupForwarder = createValueWithCallbacksEffect(resources.response, () => {
      const newV = getValue();
      if (newV === currentV) {
        return;
      }
      currentV = newV;
      callbacks.call({ updateInput: true });
      return undefined;
    });

    const wvwc: FlexGrowContentWidthTextAreaProps['value'] = {
      get: () => currentV,
      set: (v) => {
        currentV = v;
        resources.onUserChangedResponse(v);
      },
      callbacks,
    };
    setVWC(responseWrappedVWC, wvwc);
    return () => {
      cleanupForwarder();
      if (Object.is(responseWrappedVWC.get(), wvwc)) {
        responseWrappedVWC.set(null);
        responseWrappedVWC.callbacks.call(undefined);
      }
    };

    function getValue() {
      const v = resources.response.get();
      if (v.type === 'available') {
        return v.value;
      }
      return '';
    }
  }, [resources.response, responseWrappedVWC, resources.onUserChangedResponse]);

  const responseTypeVWC = useMappedValueWithCallbacks(resources.response, (r) => r.type);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        gridSizeVWC={ctx.windowSizeImmediate}
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
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
        <VerticalSpacer height={24} />
        <RenderGuardedComponent
          props={resources.question}
          component={(question) =>
            question === null ? (
              <div className={styles.spinner}>
                <InlineOsehSpinner
                  size={{
                    type: 'react-rerender',
                    props: {
                      width: 64,
                    },
                  }}
                  variant="white-thin"
                />
              </div>
            ) : question === undefined ? (
              <ContentContainer contentWidthVWC={ctx.contentWidth}>
                <div className={styles.questionError}>
                  Something went wrong loading your reflection question. Try again or contact
                  support at hi@oseh.com
                </div>
              </ContentContainer>
            ) : (
              <>
                {question.paragraphs.map((q, i) => (
                  <Fragment key={i}>
                    {i > 0 && <VerticalSpacer height={16} />}
                    <ContentContainer contentWidthVWC={ctx.contentWidth}>
                      <div className={styles.question}>{q}</div>
                    </ContentContainer>
                  </Fragment>
                ))}
              </>
            )
          }
        />
        <VerticalSpacer height={16} />
        <RenderGuardedComponent
          props={responseTypeVWC}
          component={(type) => {
            if (type === 'available') {
              return (
                <RenderGuardedComponent
                  props={responseWrappedVWC}
                  component={(valueVWC) =>
                    valueVWC !== null ? (
                      <FlexGrowContentWidthTextArea
                        placeholder="Write anything"
                        textClassName={styles.responseText}
                        submit={null}
                        value={valueVWC}
                        enterBehavior={'never-submit'}
                        refVWC={inputVWC}
                        contentWidth={ctx.contentWidth}
                        screenWidth={windowWidthVWC}
                      />
                    ) : (
                      <VerticalSpacer height={0} flexGrow={1} />
                    )
                  }
                />
              );
            }
            if (type === 'loading') {
              return (
                <div className={styles.spinner}>
                  <InlineOsehSpinner
                    size={{
                      type: 'react-rerender',
                      props: {
                        width: 64,
                      },
                    }}
                    variant="white-thin"
                  />
                </div>
              );
            }
            return (
              <ContentContainer contentWidthVWC={ctx.contentWidth}>
                <div className={styles.questionError}>
                  Something went wrong loading your reflection response. Try again or contact
                  support at <a href="mailto:hi@oseh.com">hi@oseh.com</a>
                </div>
              </ContentContainer>
            );
          }}
        />
        <VerticalSpacer height={32} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.done}>
            <RenderGuardedComponent
              props={isReadyToContinueVWC}
              component={(isReady) => (
                <Button
                  type="button"
                  variant="outlined-white-thin"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isReady) {
                      return;
                    }
                    screenWithWorking(workingVWC, async () => {
                      trace({ type: 'cta', step: 'optimistic setup + ensure saved' });

                      setVWC(
                        transition.animation,
                        await adaptExitTransition(screen.parameters.cta.exit)
                      );
                      const exitTransitionCancelable = playExitTransition(transition);

                      try {
                        await resources.ensureSaved();
                      } catch (e) {
                        trace({ type: 'cta', step: 'error saving' });
                        const err = await describeError(e);
                        setVWC(errorVWC, err);
                        await exitTransitionCancelable.promise;
                        await playEntranceTransition(transition).promise;
                        return;
                      }

                      trace({ type: 'cta', step: 'saved' });
                      const finishPop = startPop(
                        screen.parameters.cta.trigger.type === 'pop'
                          ? null
                          : {
                              slug: screen.parameters.cta.trigger.flow,
                              parameters: screen.parameters.cta.trigger.parameters,
                            },
                        screen.parameters.cta.trigger.endpoint ?? undefined
                      );
                      await exitTransitionCancelable.promise;
                      finishPop();
                    });
                  }}
                  disabled={!isReady}>
                  <div className={styles.buttonInner}>
                    {screen.parameters.cta.text}
                    <HorizontalSpacer width={8} />
                    <Forward
                      icon={{ width: 20 }}
                      container={{ width: 20, height: 20 }}
                      startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                      color={OsehColors.v4.primary.light}
                    />
                  </div>
                </Button>
              )}
            />
          </div>
        </ContentContainer>
        <VerticalSpacer height={32} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
