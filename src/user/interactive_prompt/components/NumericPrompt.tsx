import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { InteractiveNumericPrompt, InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownText } from './CountdownText';
import styles from './NumericPrompt.module.css';
import { NumericPrompt as NumericPromptType } from '../models/Prompt';
import { PromptTime, usePromptTime } from '../hooks/usePromptTime';
import { Stats, useStats } from '../hooks/useStats';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { LoginContext, LoginContextValue } from '../../../shared/contexts/LoginContext';
import { JoinLeave, useJoinLeave } from '../hooks/useJoinLeave';
import { apiFetch } from '../../../shared/ApiConstants';
import { useOnFinished } from '../hooks/useOnFinished';
import { PromptTitle } from './PromptTitle';
import {
  CarouselInfoChangedEvent,
  CarouselInfoRef,
  useCarouselInfo,
} from '../../../shared/hooks/useCarouselInfo';
import { Carousel } from '../../../shared/components/Carousel';
import { ProfilePictures } from './ProfilePictures';
import { Button } from '../../../shared/forms/Button';
import {
  VPFRRProps,
  VerticalPartlyFilledRoundedRect,
} from '../../../shared/anim/VerticalPartlyFilledRoundedRect';
import { useIndexableFakeMove } from '../hooks/useIndexableFakeMove';
import { useSimpleSelectionHandler } from '../hooks/useSimpleSelectionHandler';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { VariableStrategyProps } from '../../../shared/anim/VariableStrategyProps';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { PromptProps } from '../models/PromptProps';

const optionWidthPx = 75;
const optionHeightPx = 75;
const optionGapPx = 20;
const inactiveOpacity = 0.4;
const activeOpacity = 1.0;

const optionUnfilledColor: [number, number, number, number] = [1, 1, 1, 0.5];
const optionFilledColor: [number, number, number, number] = [1, 1, 1, 1];

export const NumericPrompt = ({
  prompt: intPrompt,
  onResponse,
  onFinished,
  countdown,
  subtitle,
  paused,
  finishEarly,
  titleMaxWidth,
  leavingCallback,
}: PromptProps<InteractiveNumericPrompt, number | null>): ReactElement => {
  const prompt = intPrompt.prompt as NumericPromptType;
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
  const selection = useWritableValueWithCallbacks<number | null>(() => null);
  const selectionValue = useMappedValueWithCallbacks(selection, (s) => {
    if (s === null) {
      return null;
    }

    let idx = -1;
    for (let val = prompt.min; val <= prompt.max; val += prompt.step) {
      idx++;
      if (idx === s) {
        return val;
      }
    }

    return null;
  });
  useEffect(() => {
    selectionValue.callbacks.add(sendOnResponse);
    sendOnResponse();
    return () => {
      selectionValue.callbacks.remove(sendOnResponse);
    };

    function sendOnResponse() {
      onResponse?.(selectionValue.get());
    }
  }, [selectionValue, onResponse]);

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

  leavingCallback.current = () => {
    joinLeave.get().leave();
  };

  const { onSkip: handleSkip } = useOnFinished({
    joinLeave: { type: 'callbacks', props: joinLeave.get, callbacks: joinLeave.callbacks },
    promptTime: { type: 'callbacks', props: promptTime.get, callbacks: promptTime.callbacks },
    selection: {
      type: 'callbacks',
      props: selectionValue.get,
      callbacks: selectionValue.callbacks,
    },
    onFinished,
  });

  const getResponses = useCallback(
    (stats: Stats) => {
      if (stats.numericActive === null) {
        return undefined;
      }
      const numericActive = stats.numericActive;

      const result: number[] = [];
      for (let i = prompt.min; i <= prompt.max; i += prompt.step) {
        result.push(numericActive.get(i) ?? 0);
      }
      return result;
    },
    [prompt]
  );
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

  const promptOptions = useMemo<number[]>(() => {
    const res: number[] = [];
    for (let i = prompt.min; i <= prompt.max; i += prompt.step) {
      res.push(i);
    }
    return res;
  }, [prompt]);
  useStoreEvents(
    {
      type: 'react-rerender',
      props: intPrompt,
    },
    promptOptions,
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
  const carouselInfo = useCarouselInfo({
    visibleWidth: Math.min(screenSize.width, 440),
    itemWidth: optionWidthPx,
    itemGap: optionGapPx,
    numItems: promptOptions.length,
    height: optionHeightPx,
  });
  useCarouselSelectionForSelection(carouselInfo, selection);

  const infos: WritableValueWithCallbacks<VPFRRProps>[] = useMemo(() => {
    return promptOptions.map((_, index) =>
      createWritableValueWithCallbacks<VPFRRProps>({
        filledHeight: 0,
        borderRadius: Math.min(optionWidthPx / 2, optionHeightPx / 2),
        unfilledColor: optionUnfilledColor,
        filledColor: optionFilledColor,
        opacity:
          carouselInfo.info.current.selectedIndex === index ? activeOpacity : inactiveOpacity,
        border: { width: 2 },
      })
    );
  }, [carouselInfo, promptOptions]);

  // manages the opacity on the options
  useEffect(() => {
    carouselInfo.onInfoChanged.current.add(handleInfoEvent);
    return () => {
      carouselInfo.onInfoChanged.current.remove(handleInfoEvent);
    };

    function handleInfoEvent(event: CarouselInfoChangedEvent) {
      if (event.current.selectedIndex === event.old.selectedIndex) {
        return;
      }

      infos[event.old.selectedIndex].set(
        Object.assign({}, infos[event.old.selectedIndex].get(), { opacity: inactiveOpacity })
      );
      infos[event.old.selectedIndex].callbacks.call(undefined);
      infos[event.current.selectedIndex].set(
        Object.assign({}, infos[event.current.selectedIndex].get(), { opacity: activeOpacity })
      );
      infos[event.current.selectedIndex].callbacks.call(undefined);
    }
  }, [carouselInfo, infos]);

  const statsAmountRef = useRef<HTMLDivElement>(null);
  // manages the height on the options and the value of statsAmountRef
  useEffect(() => {
    clientPredictedStats.callbacks.add(update);
    update();
    return () => {
      clientPredictedStats.callbacks.remove(update);
    };

    function update() {
      const newCorrectedStats = clientPredictedStats.get();

      const total = newCorrectedStats.reduce((a, b) => a + b, 0);
      const fractionals =
        total === 0 ? newCorrectedStats.map(() => 0) : newCorrectedStats.map((n) => n / total);
      const average = promptOptions.reduce((a, b, i) => a + b * fractionals[i], 0);
      if (statsAmountRef.current !== null) {
        statsAmountRef.current.textContent = average.toFixed(2);
      }

      fractionals.forEach((fractional, index) => {
        const old = infos[index].get();

        if (old.filledHeight !== fractional) {
          infos[index].set(Object.assign({}, old, { filledHeight: fractional }));
          infos[index].callbacks.call(undefined);
        }
      });
    }
  }, [stats, clientPredictedStats, infos, promptOptions]);

  return (
    <div className={styles.container}>
      {countdown && <CountdownText promptTime={promptTime} prompt={intPrompt} {...countdown} />}
      <div className={styles.prompt}>
        <PromptTitle text={prompt.text} subtitle={subtitle} titleMaxWidth={titleMaxWidth} />
        <div className={styles.carouselContainer}>
          <Carousel info={carouselInfo}>
            {promptOptions.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                className={styles.item}
                onClick={(e) => {
                  e.preventDefault();
                  const oldInfo = carouselInfo.info.current;
                  if (
                    oldInfo.selectedIndex === optionIndex ||
                    oldInfo.panning ||
                    oldInfo.inClickCooldown
                  ) {
                    return;
                  }

                  const newInfo = Object.assign({}, carouselInfo.info.current, {
                    selectedIndex: optionIndex,
                  });
                  carouselInfo.info.current = newInfo;
                  carouselInfo.onInfoChanged.current.call({
                    old: oldInfo,
                    current: newInfo,
                  });
                }}>
                <div className={styles.itemBackground}>
                  <VerticalPartlyFilledRoundedRect
                    props={{
                      type: 'callbacks',
                      props: () => infos[optionIndex].get(),
                      callbacks: infos[optionIndex].callbacks,
                    }}
                    width={optionWidthPx}
                    height={optionHeightPx}
                  />
                </div>
                <div className={styles.itemForeground}>{option}</div>
              </button>
            ))}
          </Carousel>
        </div>
        <div className={styles.statsContainer}>
          Average: <div className={styles.statsAmount} ref={statsAmountRef} />
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
          style={{ width: `${carouselInfo.info.current.visibleWidth}px` }}>
          <ProfilePictures profilePictures={profilePictures} />
        </div>
      </div>
    </div>
  );
};

/**
 * Uses the carousel info as the current selected value for the numeric prompt,
 * converting indices to values using promptOptions
 */
const useCarouselSelectionForSelection = (
  carouselInfo: CarouselInfoRef,
  selection: WritableValueWithCallbacks<number | null>
) => {
  useEffect(() => {
    carouselInfo.onInfoChanged.current.add(handleCarouselEvent);
    recheckSelection();
    return () => {
      carouselInfo.onInfoChanged.current.remove(handleCarouselEvent);
    };

    function handleCarouselEvent(event: CarouselInfoChangedEvent) {
      if (event.old.selectedIndex !== event.current.selectedIndex) {
        recheckSelection();
      }
    }

    function recheckSelection() {
      const correctSelectionIndex = carouselInfo.info.current.selectedIndex;

      if (selection.get() !== correctSelectionIndex) {
        selection.set(correctSelectionIndex);
        selection.callbacks.call(undefined);
      }
    }
  }, [carouselInfo, selection]);
};

/**
 * When the user changes their selection this hook will store the appropriate
 * event on the server
 */
const useStoreEvents = (
  prompt: VariableStrategyProps<InteractivePrompt>,
  promptOptions: number[],
  promptTime: VariableStrategyProps<PromptTime>,
  selection: VariableStrategyProps<number | null>,
  joinLeave: VariableStrategyProps<JoinLeave>,
  loginContext: LoginContextValue
) => {
  const callback = async (index: number | null, time: number) => {
    if (index === null) {
      return;
    }

    const promptVal = prompt.type === 'callbacks' ? prompt.props() : prompt.props;
    await apiFetch(
      '/api/1/interactive_prompts/events/respond_numeric_prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          interactive_prompt_uid: promptVal.uid,
          interactive_prompt_jwt: promptVal.jwt,
          session_uid: promptVal.sessionUid,
          prompt_time: time / 1000,
          data: {
            rating: promptOptions[index],
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
    callback,
  });
};
