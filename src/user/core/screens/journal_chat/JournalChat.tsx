import { Fragment, ReactElement, useEffect, useMemo } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './JournalChat.module.css';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { JournalChatResources } from './JournalChatResources';
import { JournalChatMappedParams } from './JournalChatParams';
import { IconButton } from '../../../../shared/forms/IconButton';
import { Back } from '../../../../shared/components/icons/Back';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { SystemProfile } from './icons/SystemProfile';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { Arrow } from './icons/Arrow';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';
import { ThinkingDots } from '../../../../shared/components/ThinkingDots';
import { trackClassTaken } from '../home/lib/trackClassTaken';
import { OsehColors } from '../../../../shared/OsehColors';
import { Close } from '../../../../shared/components/icons/Close';
import {
  RESIZING_TEXT_AREA_ICON_SETTINGS,
  ResizingTextArea,
  ResizingTextAreaProps,
} from '../../../../shared/components/ResizingTextArea';
import { Send } from '../../../../shared/components/icons/Send';
import { JourneyCardTopBackgroundImage } from './components/JournalCardTopBackgroundImage';

const SUGGESTIONS = [
  { text: 'I have a lot of anxiety right now', width: 160 },
  { text: 'I feel scattered and need to focus', width: 160 },
  { text: 'I’m feeling disconnected', width: 130 },
  { text: 'I’m having trouble sleeping and need to calm my mind', width: 240 },
  { text: 'I’m feeling a bit down and need encouragement', width: 238 },
  { text: 'I’m feeling happy and want to cherish this moment', width: 220 },
];

/**
 * Allows the user to talk with the system
 */
export const JournalChat = ({
  ctx,
  screen,
  resources,
  trace,
  startPop,
}: ScreenComponentProps<
  'journal_chat',
  JournalChatResources,
  JournalChatMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  useEffect(() => {
    // version 73 or below used to create the journal entry client side; we no longer
    // do this, and once a client has updated we will skip the screen to get to a flow
    // which has the server initialize the entry
    if (screen.parameters.journalEntry === null) {
      screenOut(workingVWC, startPop, transition, screen.parameters.exit, 'skip', {
        beforeDone: async () => {
          trace({ type: 'no_journal_entry' });
        },
      });
    }
  });

  const transitionState = useStandardTransitionsState(transition);
  const workingVWC = useWritableValueWithCallbacks(() => false);
  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (s) => s.width);

  const inputVWC = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  const rawInputValueVWC = useWritableValueWithCallbacks<string | null>(
    () => screen.parameters.autofill
  ) as ResizingTextAreaProps['value'];

  const chatAreaRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValueWithCallbacksEffect(resources.chat, () => {
    const chatArea = chatAreaRef.get();
    if (chatArea !== null) {
      chatArea.scrollTop = chatArea.scrollHeight;
    }
    return undefined;
  });

  const submittedVWC = useWritableValueWithCallbacks<boolean>(() => false);
  useValueWithCallbacksEffect(resources.chat, (chat) => {
    if (!submittedVWC.get() && chat !== null && chat !== undefined && chat.data.length > 2) {
      setVWC(submittedVWC, true);
    }
    return undefined;
  });

  const onSubmit = async () => {
    const ele = inputVWC.get();
    if (ele === null) {
      return;
    }

    const value = ele.value.trim();
    if (value === '') {
      return;
    }

    if (submittedVWC.get()) {
      return;
    }

    ele.blur();
    ele.value = '';
    rawInputValueVWC.set('');
    rawInputValueVWC.callbacks.call({ updateInput: true });
    setVWC(submittedVWC, true);
    resources.trySubmitUserResponse(value);
  };

  const focusedVWC = useWritableValueWithCallbacks(() => false);
  useValueWithCallbacksEffect(inputVWC, (eleRaw) => {
    if (screen.parameters.focus !== 'input') {
      return undefined;
    }

    if (focusedVWC.get()) {
      return undefined;
    }

    if (eleRaw !== null) {
      eleRaw.focus();
      setVWC(focusedVWC, true);
    }
    return undefined;
  });

  const prefersDetailedSpinners = useMemo(
    () => localStorage.getItem('journalChatDetailedSpinners') === 'true',
    []
  );

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <div className={styles.header}>
          {screen.parameters.back.type === 'back' && (
            <div className={styles.backWrapper}>
              <IconButton
                icon={
                  <Back
                    icon={{ width: 20 }}
                    container={{ width: 52, height: 53 }}
                    startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                    color={OsehColors.v4.primary.light}
                  />
                }
                srOnlyName="Back"
                onClick={(e) => {
                  e.preventDefault();

                  if (screen.parameters.back.type !== 'back') {
                    return;
                  }

                  screenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.exit,
                    screen.parameters.back.trigger,
                    {
                      beforeDone: async () => {
                        trace({ type: 'back' });
                      },
                    }
                  );
                }}
              />
            </div>
          )}
          <div className={styles.headerText}>{screen.parameters.title}</div>
          {screen.parameters.back.type === 'x' && (
            <div className={styles.xWrapper}>
              <IconButton
                icon={
                  <Close
                    icon={{ width: 24 }}
                    container={{ width: 56, height: 56 }}
                    startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                    color={OsehColors.v4.primary.light}
                  />
                }
                srOnlyName="Close"
                onClick={(e) => {
                  e.preventDefault();

                  if (screen.parameters.back.type !== 'x') {
                    return;
                  }

                  screenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.exit,
                    screen.parameters.back.trigger,
                    {
                      beforeDone: async () => {
                        trace({ type: 'x' });
                      },
                    }
                  );
                }}
              />
            </div>
          )}
        </div>
        <ContentContainer
          contentWidthVWC={ctx.contentWidth}
          scrolls
          scrollWidth={windowWidthVWC}
          justifyContent="flex-start"
          refVWC={chatAreaRef}>
          <RenderGuardedComponent
            props={resources.chat}
            component={(chat) => {
              if (chat === null) {
                return <></>;
              }
              if (chat === undefined) {
                return (
                  <>
                    <VerticalSpacer height={32} flexGrow={0} />
                    <div className={styles.systemMessage}>
                      <div className={styles.systemMessagePic}>
                        <SystemProfile />
                      </div>
                      <HorizontalSpacer width={16} />
                      <div className={styles.systemMessageText}>
                        An error occurred. Try again or contact support at hi@oseh.com
                      </div>
                    </div>
                  </>
                );
              }

              const parts: ReactElement[] = [];
              chat.data.forEach((part, partIndex) => {
                if (part.type === 'chat') {
                  if (part.data.type !== 'textual') {
                    return;
                  }
                  if (parts.length > 0) {
                    parts.push(<VerticalSpacer height={24} key={parts.length} />);
                  }

                  const textPartElements: ReactElement[] = [];
                  part.data.parts.forEach((textPart) => {
                    if (textPartElements.length > 0) {
                      textPartElements.push(
                        <VerticalSpacer height={24} key={textPartElements.length} />
                      );
                    }
                    if (textPart.type === 'paragraph') {
                      textPartElements.push(
                        <p key={textPartElements.length} className={styles.paragraph}>
                          {textPart.value}
                        </p>
                      );
                    } else if (textPart.type === 'journey') {
                      textPartElements.push(
                        <button
                          type="button"
                          key={textPartElements.length}
                          className={styles.journeyCard}
                          onClick={(e) => {
                            e.preventDefault();
                            const journalEntryUID = resources.journalEntryUID.get();
                            if (journalEntryUID === null) {
                              return;
                            }

                            const journalEntryJWT = resources.journalEntryJWT.get();
                            if (journalEntryJWT === null) {
                              return;
                            }

                            screenOut(
                              workingVWC,
                              startPop,
                              transition,
                              screen.parameters.exit,
                              screen.parameters.journeyTrigger,
                              {
                                endpoint: '/api/1/users/me/screens/pop_to_journal_chat_class',
                                parameters: {
                                  journal_entry_uid: journalEntryUID,
                                  journal_entry_jwt: journalEntryJWT,
                                  entry_counter: partIndex + 1,
                                  journey_uid: textPart.uid,
                                  upgrade_slug: screen.parameters.upgradeTrigger,
                                },
                                afterDone:
                                  textPart.details.access !== 'paid-requires-upgrade'
                                    ? async () => {
                                        trackClassTaken(ctx);
                                      }
                                    : undefined,
                              }
                            );
                          }}>
                          <div className={styles.journeyCardTop}>
                            <div className={styles.journeyCardTopBackground}>
                              <JourneyCardTopBackgroundImage
                                uid={textPart.details.darkened_background.uid}
                                jwt={textPart.details.darkened_background.jwt}
                                ctx={ctx}
                              />
                            </div>
                            <div className={styles.journeyCardTopForeground}>
                              {textPart.details.access === 'paid-requires-upgrade' && (
                                <div className={styles.journeyCardTopForegroundPaid}>
                                  <div className={styles.journeyCardTopForegroundPaidText}>
                                    Free Trial
                                  </div>
                                </div>
                              )}
                              <VerticalSpacer height={0} flexGrow={1} />
                              <div className={styles.journeyCardTopForegroundTitle}>
                                {textPart.details.title}
                              </div>
                              <VerticalSpacer height={2} />
                              <div className={styles.journeyCardTopForegroundInstructor}>
                                {textPart.details.instructor.name}
                              </div>
                            </div>
                          </div>
                          <div className={styles.journeyCardBottom}>
                            <div className={styles.journeyCardInfo}>
                              {(() => {
                                const inSeconds = textPart.details.duration_seconds;
                                const minutes = Math.floor(inSeconds / 60);
                                const seconds = Math.floor(inSeconds) % 60;

                                return (
                                  <>
                                    {minutes}:{seconds < 10 ? '0' : ''}
                                    {seconds}
                                  </>
                                );
                              })()}
                            </div>
                            <HorizontalSpacer width={0} flexGrow={1} />
                            <Arrow />
                          </div>
                        </button>
                      );
                    }
                  });

                  if (part.display_author === 'self') {
                    parts.push(
                      <div className={styles.selfMessage} key={parts.length}>
                        <div className={styles.selfMessageText}>{textPartElements}</div>
                      </div>
                    );
                  } else {
                    parts.push(
                      <div className={styles.systemMessage} key={parts.length}>
                        <div className={styles.systemMessagePic}>
                          <SystemProfile />
                        </div>
                        <HorizontalSpacer width={16} />
                        <div className={styles.systemMessageText}>{textPartElements}</div>
                      </div>
                    );
                  }
                }
              });

              return (
                <>
                  <VerticalSpacer height={32} flexGrow={0} />
                  {parts}
                  {prefersDetailedSpinners && chat.transient?.type === 'thinking-spinner' ? (
                    <>
                      <VerticalSpacer height={24} flexGrow={1} />
                      <div className={styles.spinnerContainer}>
                        <InlineOsehSpinner
                          size={{ type: 'react-rerender', props: { width: 40 } }}
                        />
                      </div>
                      <VerticalSpacer height={12} />
                      <div className={styles.spinnerMessage}>{chat.transient.message}</div>
                      <VerticalSpacer height={4} />
                      {chat.transient.detail !== null && (
                        <div className={styles.spinnerDetail}>{chat.transient.detail}</div>
                      )}
                      <VerticalSpacer height={24} flexGrow={1} />
                    </>
                  ) : undefined}
                  {prefersDetailedSpinners && chat.transient?.type === 'thinking-bar' ? (
                    <>
                      <VerticalSpacer height={24} flexGrow={1} />
                      <div className={styles.spinnerContainer}>
                        <progress
                          className={styles.progress}
                          value={chat.transient.at}
                          max={chat.transient.of}
                        />
                      </div>
                      <VerticalSpacer height={12} />
                      <div className={styles.spinnerMessage}>{chat.transient.message}</div>
                      <VerticalSpacer height={4} />
                      {chat.transient.detail !== null && (
                        <div className={styles.spinnerDetail}>{chat.transient.detail}</div>
                      )}
                      <VerticalSpacer height={24} flexGrow={1} />
                    </>
                  ) : undefined}
                  {!prefersDetailedSpinners && chat.transient?.type?.startsWith('thinking') ? (
                    <>
                      <VerticalSpacer height={24} />
                      <ThinkingDots />
                      <VerticalSpacer height={24} />
                    </>
                  ) : undefined}
                </>
              );
            }}
          />
          <RenderGuardedComponent
            props={submittedVWC}
            component={(submitted) => <VerticalSpacer height={submitted ? 40 : 12} />}
          />
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={1} />

        <RenderGuardedComponent
          props={submittedVWC}
          component={(submitted) =>
            submitted ? (
              <></>
            ) : (
              <>
                <div className={styles.hint}>
                  Type a message below or tap a suggestion to get started
                </div>
                <VerticalSpacer height={16} />
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion, i) => (
                    <Fragment key={i}>
                      <HorizontalSpacer width={i === 0 ? 16 : 12} />
                      <button
                        type="button"
                        className={styles.suggestion}
                        onClick={(e) => {
                          e.preventDefault();

                          const ele = inputVWC.get();
                          if (ele === null) {
                            return;
                          }

                          rawInputValueVWC.set(suggestion.text);
                          rawInputValueVWC.callbacks.call({ updateInput: true });
                          ele.focus();
                        }}
                        style={{
                          width: `${suggestion.width}px`,
                          flex: `${suggestion.width}px 0 0`,
                        }}>
                        {suggestion.text}
                      </button>
                      <HorizontalSpacer width={i === SUGGESTIONS.length - 1 ? 16 : 0} />
                    </Fragment>
                  ))}
                </div>
                <VerticalSpacer height={16} />
                <ContentContainer contentWidthVWC={ctx.contentWidth}>
                  <ResizingTextArea
                    variant="dark"
                    placeholder="Type your message"
                    submit={{
                      icon: (
                        <Send
                          color2={OsehColors.v4.primary.dark}
                          color={OsehColors.v4.primary.light}
                          {...RESIZING_TEXT_AREA_ICON_SETTINGS}
                        />
                      ),
                      onClick: onSubmit,
                    }}
                    value={rawInputValueVWC}
                    refVWC={inputVWC}
                    enterBehavior="submit-unless-shift"
                  />
                </ContentContainer>

                <VerticalSpacer height={40} />
              </>
            )
          }
        />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
