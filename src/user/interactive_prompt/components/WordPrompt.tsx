import { ReactElement, useContext, useEffect, useMemo, useRef } from 'react';
import { PromptTime, usePromptTime } from '../hooks/usePromptTime';
import { InteractivePrompt, InteractiveWordPrompt } from '../models/InteractivePrompt';
import { CountdownText } from './CountdownText';
import styles from './WordPrompt.module.css';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { Stats, useStats } from '../hooks/useStats';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext, LoginContextValue } from '../../../shared/contexts/LoginContext';
import { JoinLeave, useJoinLeave } from '../hooks/useJoinLeave';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { ProfilePictures } from './ProfilePictures';
import { useOnFinished } from '../hooks/useOnFinished';
import { PromptTitle } from './PromptTitle';
import { useSimpleSelectionHandler } from '../hooks/useSimpleSelectionHandler';
import { Button } from '../../../shared/forms/Button';
import { HorizontalPartlyFilledRoundedRect } from '../../../shared/anim/HorizontalPartlyFilledRoundedRect';
import { useIndexableFakeMove } from '../hooks/useIndexableFakeMove';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { VariableStrategyProps } from '../../../shared/anim/VariableStrategyProps';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { PromptProps } from '../models/PromptProps';

type WordPromptProps = PromptProps<InteractiveWordPrompt, string | null>;

const unfilledColor: [number, number, number, number] = [68 / 255, 98 / 255, 102 / 255, 0.4];
const filledColor: [number, number, number, number] = [68 / 255, 98 / 255, 102 / 255, 0.9];
const getResponses = (stats: Stats): number[] | undefined => stats.wordActive ?? undefined;

export const WordPrompt = ({
  prompt: intPrompt,
  onFinished,
  onResponse,
  countdown,
  subtitle,
  paused,
  finishEarly,
  titleMaxWidth,
  leavingCallback,
}: WordPromptProps): ReactElement => {
  const prompt = intPrompt.prompt;
  const promptTime = usePromptTime({
    type: 'react-rerender',
    props: { initialTime: -250, paused: paused ?? false },
  });
  const stats = useStats({
    prompt: {
      type: 'react-rerender',
      props: intPrompt,
    },
    promptTime: {
      type: 'callbacks',
      props: promptTime.get,
      callbacks: promptTime.callbacks,
    },
  });
  const selection = useWritableValueWithCallbacks<number | null>(() => {
    onResponse?.(null);
    return null;
  });
  const selectionWord = useMappedValueWithCallbacks(selection, (s) =>
    s === null ? null : prompt.options[s]
  );
  const hasSelectionVWC = useMappedValueWithCallbacks(selection, (s) => s !== null);
  const screenSize = useWindowSize();
  const clientPredictedStats = useWritableValueWithCallbacks<number[]>(() => []);
  const profilePictures = useProfilePictures({
    prompt: {
      type: 'react-rerender',
      props: intPrompt,
    },
    promptTime: {
      type: 'callbacks',
      props: promptTime.get,
      callbacks: promptTime.callbacks,
    },
    stats: {
      type: 'callbacks',
      props: stats.get,
      callbacks: stats.callbacks,
    },
  });
  const loginContext = useContext(LoginContext);
  const joinLeave = useJoinLeave({
    prompt: {
      type: 'react-rerender',
      props: intPrompt,
    },
    promptTime: {
      type: 'callbacks',
      props: promptTime.get,
      callbacks: promptTime.callbacks,
    },
  });
  const windowSize = useWindowSize();
  const responses = useMappedValueWithCallbacks(stats, getResponses);
  useIndexableFakeMove({
    promptTime: {
      type: 'callbacks',
      props: promptTime.get,
      callbacks: promptTime.callbacks,
    },
    responses: {
      type: 'callbacks',
      props: responses.get,
      callbacks: responses.callbacks,
    },
    selection: {
      type: 'callbacks',
      props: selection.get,
      callbacks: selection.callbacks,
    },
    clientPredictedStats,
  });
  useStoreEvents(
    {
      type: 'react-rerender',
      props: intPrompt,
    },
    {
      type: 'callbacks',
      props: promptTime.get,
      callbacks: promptTime.callbacks,
    },
    {
      type: 'callbacks',
      props: selection.get,
      callbacks: selection.callbacks,
    },
    {
      type: 'callbacks',
      props: joinLeave.get,
      callbacks: joinLeave.callbacks,
    },
    loginContext
  );

  leavingCallback.current = () => {
    joinLeave.get().leave();
  };

  const { onSkip: handleSkip } = useOnFinished({
    joinLeave: { type: 'callbacks', props: joinLeave.get, callbacks: joinLeave.callbacks },
    promptTime: { type: 'callbacks', props: promptTime.get, callbacks: promptTime.callbacks },
    selection: {
      type: 'callbacks',
      props: selectionWord.get,
      callbacks: selectionWord.callbacks,
    },
    onFinished,
  });

  const boundFilledWidthGetterSetters: WritableValueWithCallbacks<number>[] = useMemo(() => {
    return prompt.options.map(() => createWritableValueWithCallbacks<number>(0));
  }, [prompt]);

  useEffect(() => {
    clientPredictedStats.callbacks.add(updateWidths);
    return () => {
      clientPredictedStats.callbacks.add(updateWidths);
    };

    function updateWidths() {
      const correctedStats = clientPredictedStats.get();
      const totalResponses = correctedStats.reduce((a, b) => a + b, 0);
      const fractionals =
        totalResponses === 0
          ? correctedStats.map(() => 0)
          : correctedStats.map((v) => v / totalResponses);
      fractionals.forEach((fractional, idx) => {
        const old = boundFilledWidthGetterSetters[idx].get();
        if (old === fractional) {
          return;
        }
        boundFilledWidthGetterSetters[idx].set(fractional);
        boundFilledWidthGetterSetters[idx].callbacks.call(undefined);
      });
    }
  }, [stats, clientPredictedStats, boundFilledWidthGetterSetters]);

  const optionWidth = Math.min(390, Math.min(screenSize.width, 440) - 48);

  return (
    <div className={styles.container}>
      {countdown && <CountdownText promptTime={promptTime} prompt={intPrompt} {...countdown} />}
      <div
        className={styles.prompt}
        style={!countdown || !finishEarly || windowSize.height > 700 ? {} : { marginTop: '12px' }}>
        {/* we run out of space with countdown && finishEarly */}
        <PromptTitle text={prompt.text} subtitle={subtitle} titleMaxWidth={titleMaxWidth} />
        <div className={styles.options}>
          {prompt.options.map((option, idx) => {
            return (
              <div key={idx} className={styles.option} style={{ width: optionWidth, height: 54 }}>
                <div className={styles.optionBackground}>
                  <HorizontalPartlyFilledRoundedRect
                    props={{
                      type: 'callbacks',
                      props: () => ({
                        filledWidth: boundFilledWidthGetterSetters[idx].get(),
                        unfilledColor: unfilledColor,
                        filledColor: filledColor,
                        opacity: 1.0,
                        borderRadius: 10,
                      }),
                      callbacks: boundFilledWidthGetterSetters[idx].callbacks,
                    }}
                    height={54}
                    width={optionWidth}
                  />
                </div>
                <button
                  className={styles.optionForeground}
                  style={{ width: optionWidth, height: 54 }}
                  onClick={() => {
                    if (selection.get() === idx) {
                      return;
                    }

                    selection.set(idx);
                    selection.callbacks.call(undefined);

                    if (onResponse) {
                      onResponse(option);
                    }
                  }}>
                  <CheckmarkFromSelection index={idx} selection={selection} />
                  <div className={styles.optionText}>{option}</div>
                </button>
              </div>
            );
          })}
        </div>
        {finishEarly && (
          <div
            className={styles.continueContainer}
            style={
              countdown && windowSize.height <= 750
                ? {}
                : { paddingTop: '45px', paddingBottom: '60px' }
            }>
            <RenderGuardedComponent
              props={hasSelectionVWC}
              component={(hasSelection) => (
                <Button
                  type="button"
                  fullWidth
                  variant={hasSelection ? 'filled' : 'link-white'}
                  onClick={handleSkip}>
                  {hasSelection ? (finishEarly === true ? 'Continue' : finishEarly.cta) : 'Skip'}
                </Button>
              )}
            />
          </div>
        )}
        <div
          className={styles.profilePictures}
          style={Object.assign(
            { width: `${optionWidth}px` },
            countdown || !finishEarly
              ? null
              : {
                  marginTop: '5px',
                  marginBottom: '8px',
                }
          )}>
          <ProfilePictures profilePictures={profilePictures} />
        </div>
      </div>
    </div>
  );
};

/**
 * Shows a checkmark which is checked if the selection matches the
 * given index, and unchecked otherwise, without triggering react
 * state updates.
 */
const CheckmarkFromSelection = ({
  index,
  selection,
}: {
  index: number;
  selection: ValueWithCallbacks<number | null>;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isChecked: boolean | null = null;
    selection.callbacks.add(onEvent);
    return () => {
      selection.callbacks.remove(onEvent);
    };

    function onEvent() {
      const isNowChecked = selection.get() === index;
      if (isChecked !== isNowChecked && containerRef.current) {
        containerRef.current.classList.toggle(styles.checkmarkContainerChecked, isNowChecked);
      }
    }
  }, [index, selection]);

  return (
    <div
      ref={containerRef}
      className={`${styles.checkmarkContainer} ${
        index === selection.get() ? styles.checkmarkContainerChecked : ''
      }`}>
      <div className={styles.checkmark} />
    </div>
  );
};

/**
 * When the user changes their selection this hook will store the appropriate
 * event on the server
 */
const useStoreEvents = (
  prompt: VariableStrategyProps<InteractivePrompt>,
  promptTime: VariableStrategyProps<PromptTime>,
  selection: VariableStrategyProps<number | null>,
  joinLeave: VariableStrategyProps<JoinLeave>,
  loginContext: LoginContextValue
) => {
  const handler = async (index: number | null, time: number) => {
    if (index === null) {
      return;
    }

    const promptVal = prompt.type === 'callbacks' ? prompt.props() : prompt.props;
    await apiFetch(
      '/api/1/interactive_prompts/events/respond_word_prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          interactive_prompt_uid: promptVal.uid,
          interactive_prompt_jwt: promptVal.jwt,
          session_uid: promptVal.sessionUid,
          prompt_time: time / 1000,
          data: {
            index,
          },
        }),
        keepalive: true,
      },
      loginContext
    );
  };

  useSimpleSelectionHandler({
    selection,
    prompt,
    joinLeave,
    promptTime,
    callback: handler,
  });
};
