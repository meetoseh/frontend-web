import { Fragment, ReactElement, useEffect } from 'react';
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
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { trackClassTaken } from '../home/lib/trackClassTaken';
import { OsehColors } from '../../../../shared/OsehColors';
import { Close } from '../../../../shared/components/icons/Close';
import { VoiceOrTextInput } from '../../../../shared/components/voiceOrTextInput/VoiceOrTextInput';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { VoiceNoteStateMachine } from './lib/createVoiceNoteStateMachine';
import { JournalEntryItemTextualPartJourney } from './lib/JournalChatState';
import { OsehStyles } from '../../../../shared/OsehStyles';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { JournalChatSpinners } from './components/JournalChatSpinners';
import { JournalChatParts } from './components/JournalChatParts';
import { DisplayableError } from '../../../../shared/lib/errors';

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

  const inputVWC = useWritableValueWithCallbacks<{ focus: () => void; blur: () => void } | null>(
    () => null
  );
  const rawInputValueVWC = useWritableValueWithCallbacks<string>(() => screen.parameters.autofill);
  const inputTypeVWC = useWritableValueWithCallbacks<'text' | 'voice'>(() => 'text');
  const fullInputValueVWC = useMappedValuesWithCallbacks(
    [inputTypeVWC, rawInputValueVWC],
    (): { type: 'text'; value: string } | { type: 'voice' } => {
      if (inputTypeVWC.get() === 'text') {
        return { type: 'text', value: rawInputValueVWC.get() };
      }
      return { type: 'voice' };
    }
  );

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

  const onSubmit = async (
    v: { type: 'text'; value: string } | { type: 'voice'; voiceNote: VoiceNoteStateMachine }
  ) => {
    if (submittedVWC.get()) {
      return;
    }

    if (v.type === 'text' && v.value.trim() === '') {
      return;
    }

    inputVWC.get()?.blur();
    setVWC(rawInputValueVWC, '');
    setVWC(inputTypeVWC, 'text');
    setVWC(submittedVWC, true);
    resources.trySubmitUserResponse(v);
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

  const onClickJourneyCard = (
    part: JournalEntryItemTextualPartJourney,
    partIndex: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
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
          journey_uid: part.uid,
          upgrade_slug: screen.parameters.upgradeTrigger,
        },
        afterDone:
          part.details.access !== 'paid-requires-upgrade'
            ? async () => {
                trackClassTaken(ctx);
              }
            : undefined,
      }
    );
  };

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
                    <RenderGuardedComponent
                      props={resources.chatError}
                      component={(chatError) => {
                        const err =
                          chatError ?? new DisplayableError('client', 'show journal entry');
                        return (
                          <>
                            <div
                              className={combineClasses(
                                OsehStyles.typography.body,
                                OsehStyles.colors.v4.experimental.lightError
                              )}
                              style={{ width: '100%', wordBreak: 'break-all' }}>
                              {err.formatProblem()}
                            </div>
                          </>
                        );
                      }}
                    />
                  </>
                );
              }

              return (
                <>
                  <VerticalSpacer height={32} flexGrow={0} />
                  <JournalChatParts
                    ctx={ctx}
                    refreshChat={resources.refreshJournalEntry}
                    onGotoJourney={onClickJourneyCard}
                    chat={chat}
                  />
                  <JournalChatSpinners ctx={ctx} chat={chat} />
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

                          setVWC(rawInputValueVWC, suggestion.text);
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
                  <VoiceOrTextInput
                    placeholder="Type your message"
                    onSubmit={onSubmit}
                    value={fullInputValueVWC}
                    onValueChanged={(v) => {
                      if (v.type === 'text') {
                        setVWC(rawInputValueVWC, v.value);
                        setVWC(inputTypeVWC, 'text');
                      } else {
                        setVWC(inputTypeVWC, 'voice');
                      }
                    }}
                    onFocuser={(f) => setVWC(inputVWC, f)}
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
