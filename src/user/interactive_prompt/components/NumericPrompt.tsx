import {
  MutableRefObject,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownText, CountdownTextConfig } from './CountdownText';
import styles from './NumericPrompt.module.css';
import { NumericPrompt as NumericPromptType } from '../models/Prompt';
import { PromptTime, usePromptTime } from '../hooks/usePromptTime';
import { Stats, useStats } from '../hooks/useStats';
import { Callbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
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
import {
  SimpleSelectionRef,
  useSimpleSelection,
  useSimpleSelectionHasSelection,
} from '../hooks/useSimpleSelection';
import { Button } from '../../../shared/forms/Button';
import {
  VPFRRProps,
  VerticalPartlyFilledRoundedRect,
} from '../../../shared/anim/VerticalPartlyFilledRoundedRect';
import { useIndexableFakeMove } from '../hooks/useIndexableFakeMove';
import { useSimpleSelectionHandler } from '../hooks/useSimpleSelectionHandler';

type NumericPromptProps = {
  /**
   * The prompt to display. Must be a word prompt.
   */
  prompt: InteractivePrompt;

  /**
   * The function to call when the user finishes the prompt.
   */
  onFinished: (privileged: boolean) => void;

  /**
   * If specified, a countdown is displayed using the given props.
   */
  countdown?: CountdownTextConfig;

  /**
   * If specified, a subtitle is displayed with the given contents,
   * e.g., "Class Poll".
   */
  subtitle?: string;

  /**
   * If set to true, the prompt time will not be updated.
   */
  paused?: boolean;

  /**
   * If set to true, a more obvious button is included to let the user
   * move on. The button prominence is reduced until the user answers,
   * but still more prominent than the default X button.
   */
  finishEarly?: boolean | { cta: string };

  /**
   * If specified, used to configure the max width of the title in pixels.
   * It's often useful to configure this if the prompt title is known in
   * advance to get an aesthetically pleasing layout.
   */
  titleMaxWidth?: number;

  /**
   * The ref to register a leaving callback which must be called before unmounting
   * the component normally in order to trigger a leave event. Otherwise, a leave
   * event is only triggered when the prompt finishes normally or the page is
   * closed (via onbeforeunload)
   */
  leavingCallback: MutableRefObject<(() => void) | null>;
};

const optionWidthPx = 75;
const optionHeightPx = 75;
const optionGapPx = 20;
const inactiveOpacity = 0.4;
const activeOpacity = 1.0;

const optionUnfilledColor: [number, number, number, number] = [1, 1, 1, 0.5];
const optionFilledColor: [number, number, number, number] = [1, 1, 1, 1];

export const NumericPrompt = ({
  prompt: intPrompt,
  onFinished,
  countdown,
  subtitle,
  paused,
  finishEarly,
  titleMaxWidth,
  leavingCallback,
}: NumericPromptProps): ReactElement => {
  if (intPrompt.prompt.style !== 'numeric') {
    throw new Error('NumericPrompt must be given a numeric prompt');
  }
  const prompt = intPrompt.prompt as NumericPromptType;
  const promptTime = usePromptTime(-250, paused ?? false);
  const stats = useStats({ prompt: intPrompt, promptTime });
  const selection = useSimpleSelection<number>();
  const hasSelection = useSimpleSelectionHasSelection(selection);
  const screenSize = useWindowSize();
  const clientPredictedStats = useWritableValueWithCallbacks<number[]>([]);
  const profilePictures = useProfilePictures({ prompt: intPrompt, promptTime, stats });
  const loginContext = useContext(LoginContext);
  const joinLeave = useJoinLeave({ prompt: intPrompt, promptTime });
  const windowSize = useWindowSize();
  useOnFinished(intPrompt, promptTime, onFinished);

  leavingCallback.current = () => {
    joinLeave.leaving.current = true;
  };

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
  useIndexableFakeMove({
    getResponses,
    promptTime,
    promptStats: stats,
    selection,
    clientPredictedStats,
  });

  const promptOptions = useMemo<number[]>(() => {
    const res: number[] = [];
    for (let i = prompt.min; i <= prompt.max; i += prompt.step) {
      res.push(i);
    }
    return res;
  }, [prompt]);
  useStoreEvents(intPrompt, promptOptions, promptTime, joinLeave, selection, loginContext);

  const handleSkip = useCallback(() => {
    leavingCallback.current?.();
    onFinished(true);
  }, [onFinished, leavingCallback]);

  const carouselInfo = useCarouselInfo({
    visibleWidth: Math.min(screenSize.width, 440),
    itemWidth: optionWidthPx,
    itemGap: optionGapPx,
    numItems: promptOptions.length,
    height: optionHeightPx,
  });
  useCarouselSelectionForSelection(carouselInfo, selection);

  const infos: {
    get: () => VPFRRProps;
    callbacks: Callbacks<undefined>;
    set: (state: VPFRRProps) => void;
  }[] = useMemo(() => {
    return promptOptions.map((_, index) => {
      let state: VPFRRProps = {
        filledHeight: 0,
        borderRadius: Math.min(optionWidthPx / 2, optionHeightPx / 2),
        unfilledColor: optionUnfilledColor,
        filledColor: optionFilledColor,
        opacity:
          carouselInfo.info.current.selectedIndex === index ? activeOpacity : inactiveOpacity,
        border: { width: 2 },
      };

      const callbacks = new Callbacks<undefined>();

      return {
        get: () => state,
        callbacks,
        set: (newState: VPFRRProps) => {
          state = newState;
          callbacks.call(undefined);
        },
      };
    });
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
      infos[event.current.selectedIndex].set(
        Object.assign({}, infos[event.current.selectedIndex].get(), { opacity: activeOpacity })
      );
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
            <Button
              type="button"
              fullWidth
              variant={hasSelection ? 'filled' : 'link-white'}
              onClick={handleSkip}>
              {hasSelection ? (finishEarly === true ? 'Continue' : finishEarly.cta) : 'Skip'}
            </Button>
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
  selection: SimpleSelectionRef<number>
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

      if (
        selection.selection.current === null ||
        selection.selection.current !== correctSelectionIndex
      ) {
        const old = selection.selection.current;
        selection.selection.current = correctSelectionIndex;
        selection.onSelectionChanged.current.call({
          old,
          current: selection.selection.current,
        });
      }
    }
  }, [carouselInfo, selection]);
};

/**
 * When the user changes their selection this hook will store the appropriate
 * event on the server
 */
const useStoreEvents = (
  prompt: InteractivePrompt,
  promptOptions: number[],
  promptTime: PromptTime,
  joinLeave: JoinLeave,
  selection: SimpleSelectionRef<number>,
  loginContext: LoginContextValue
) => {
  const callback = async (index: number, time: number) => {
    await apiFetch(
      '/api/1/interactive_prompts/events/respond_numeric_prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          interactive_prompt_uid: prompt.uid,
          interactive_prompt_jwt: prompt.jwt,
          session_uid: prompt.sessionUid,
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
