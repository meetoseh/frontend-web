import { MutableRefObject, ReactElement, useContext, useEffect, useMemo, useRef } from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownText, CountdownTextConfig } from './CountdownText';
import styles from './NumericPrompt.module.css';
import { NumericPrompt as NumericPromptType } from '../models/Prompt';
import {
  PromptTime,
  PromptTimeEvent,
  usePromptTime,
  waitUntilUsingPromptTimeCancelable,
} from '../hooks/usePromptTime';
import { PromptStats, StatsChangedEvent, useStats } from '../hooks/useStats';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { LoginContext, LoginContextValue } from '../../../shared/LoginContext';
import { useJoinLeave } from '../hooks/useJoinLeave';
import { apiFetch } from '../../../shared/ApiConstants';
import { useOnFinished } from '../hooks/useOnFinished';
import { PromptTitle } from './PromptTitle';
import {
  CarouselInfoChangedEvent,
  CarouselInfoRef,
  useCarouselInfo,
} from '../hooks/useCarouselInfo';
import { Carousel } from './Carousel';
import {
  VerticalPartlyFilledRoundedRect,
  VPFRRState,
  VPFRRStateChangedEvent,
} from './VerticalPartlyFilledRoundedRect';
import { ProfilePictures } from './ProfilePictures';

type NumericPromptProps = {
  /**
   * The prompt to display. Must be a word prompt.
   */
  prompt: InteractivePrompt;

  /**
   * The function to call when the user finishes the prompt.
   */
  onFinished: () => void;

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
};

const optionWidthPx = 75;
const optionHeightPx = 75;
const optionGapPx = 20;
const inactiveOpacity = 0.4;
const activeOpacity = 1.0;

const optionUnfilledColor: [number, number, number, number] = [1, 1, 1, 0.5];
const optionFilledColor: [number, number, number, number] = [1, 1, 1, 1];
const optionBorderColor = optionFilledColor;

export const NumericPrompt = ({
  prompt: intPrompt,
  onFinished,
  countdown,
  subtitle,
  paused,
}: NumericPromptProps): ReactElement => {
  if (intPrompt.prompt.style !== 'numeric') {
    throw new Error('NumericPrompt must be given a numeric prompt');
  }
  const prompt = intPrompt.prompt as NumericPromptType;
  const promptTime = usePromptTime(-250, paused ?? true);
  const stats = useStats({ prompt: intPrompt, promptTime });
  const selection = useSelection();
  const screenSize = useWindowSize();
  const fakeMove = useFakeMove(promptTime, stats, selection);
  const profilePictures = useProfilePictures({ prompt: intPrompt, promptTime, stats });
  const loginContext = useContext(LoginContext);
  useJoinLeave({ prompt: intPrompt, promptTime });
  useStoreEvents(intPrompt, promptTime, selection, loginContext);
  useOnFinished(intPrompt, promptTime, onFinished);

  const promptOptions = useMemo<number[]>(() => {
    const res: number[] = [];
    for (let i = prompt.min; i <= prompt.max; i += prompt.step) {
      res.push(i);
    }
    return res;
  }, [prompt]);

  const carouselInfo = useCarouselInfo({
    visibleWidth: Math.min(screenSize.width, 440),
    itemWidth: optionWidthPx,
    itemGap: optionGapPx,
    numItems: promptOptions.length,
    height: optionHeightPx,
  });
  useCarouselSelectionForSelection(carouselInfo, selection, promptOptions);

  const infos: {
    get: () => VPFRRState;
    callbacks: () => Callbacks<VPFRRStateChangedEvent>;
    set: (state: VPFRRState) => void;
  }[] = useMemo(() => {
    return promptOptions.map((_, index) => {
      let state: VPFRRState = {
        opacity:
          carouselInfo.info.current.selectedIndex === index ? activeOpacity : inactiveOpacity,
        filledHeight: 0,
      };

      const callbacks = new Callbacks<VPFRRStateChangedEvent>();

      return {
        get: () => state,
        callbacks: () => callbacks,
        set: (newState: VPFRRState) => {
          const old = state;
          state = newState;
          callbacks.call({
            old,
            current: newState,
          });
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
    stats.onStatsChanged.current.add(update);
    fakeMove.onFakeMoveChanged.current.add(update);
    update();
    return () => {
      stats.onStatsChanged.current.remove(update);
      fakeMove.onFakeMoveChanged.current.remove(update);
    };

    function update() {
      if (stats.stats.current.numericActive === null) {
        return;
      }

      const newCorrectedStats = correctWithFakeMove(
        stats.stats.current.numericActive,
        fakeMove.fakeMove.current
      );

      const total = Array.from(newCorrectedStats.values()).reduce((a, b) => a + b, 0);
      const fractionals =
        total === 0
          ? promptOptions.map(() => 0)
          : promptOptions.map((option) => {
              return (newCorrectedStats.get(option) ?? 0) / total;
            });
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
  }, [stats, fakeMove, infos, promptOptions]);

  return (
    <div className={styles.container}>
      {countdown && <CountdownText promptTime={promptTime} prompt={intPrompt} {...countdown} />}
      <div className={styles.prompt}>
        <PromptTitle text={prompt.text} subtitle={subtitle} />
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
                    height={optionHeightPx}
                    width={optionWidthPx}
                    unfilledColor={optionUnfilledColor}
                    filledColor={optionFilledColor}
                    borderRadius={Math.max(optionWidthPx / 3, optionHeightPx / 3)}
                    state={infos[optionIndex].get}
                    onStateChanged={infos[optionIndex].callbacks}
                    border={{ width: 2, color: optionBorderColor }}
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
        <div
          className={styles.profilePictures}
          style={{ width: `${carouselInfo.info.current.visibleWidth}px` }}>
          <ProfilePictures profilePictures={profilePictures} />
        </div>
      </div>
    </div>
  );
};

type NumericPromptSelection = {
  /**
   * If the options were iterated over from min to max by step,
   * this is the index of the selected option.
   */
  index: number;

  /**
   * The value of the selected option.
   */
  value: number;
};

type NumericPromptSelectionChangedEvent = {
  /**
   * The old selection, or null if there was no old selection.
   */
  old: NumericPromptSelection | null;

  /**
   * The new selection
   */
  current: NumericPromptSelection;
};

type NumericPromptSelectionRef = {
  /**
   * The current selection
   */
  selection: MutableRefObject<NumericPromptSelection | null>;

  /**
   * The callbacks to call when the selection changes
   */
  onSelectionChanged: MutableRefObject<Callbacks<NumericPromptSelectionChangedEvent>>;
};

const useSelection = (): NumericPromptSelectionRef => {
  const selection = useRef<NumericPromptSelection | null>(null);
  const onSelectionChanged = useRef<
    Callbacks<NumericPromptSelectionChangedEvent>
  >() as MutableRefObject<Callbacks<NumericPromptSelectionChangedEvent>>;

  if (onSelectionChanged.current === undefined) {
    onSelectionChanged.current = new Callbacks();
  }

  return useMemo(
    () => ({
      selection,
      onSelectionChanged,
    }),
    []
  );
};

/**
 * Uses the carousel info as the current selected value for the numeric prompt,
 * converting indices to values using promptOptions
 */
const useCarouselSelectionForSelection = (
  carouselInfo: CarouselInfoRef,
  selection: NumericPromptSelectionRef,
  promptOptions: number[]
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
      const correctSelectionValue = promptOptions[correctSelectionIndex];

      if (
        selection.selection.current === null ||
        selection.selection.current.value !== correctSelectionValue ||
        selection.selection.current.index !== correctSelectionIndex
      ) {
        const old = selection.selection.current;
        selection.selection.current = {
          index: correctSelectionIndex,
          value: correctSelectionValue,
        };
        selection.onSelectionChanged.current.call({
          old,
          current: selection.selection.current,
        });
      }
    }
  }, [carouselInfo, selection, promptOptions]);
};

type FakeMove = {
  /**
   * The keys are the values of the options, and the values are the deltas
   * to apply to the stats. Options whose stats should not be modified may
   * be omitted.
   */
  deltas: Map<number, number>;
};

/**
 * The event that is fired when the fake move changes
 */
type FakeMoveChangedEvent = {
  /**
   * The previous fake move, or null if there was no previous fake move
   */
  old: FakeMove | null;

  /**
   * The current fake move, or null if there is no current fake move
   */
  current: FakeMove | null;
};

type FakeMoveRef = {
  /**
   * The current fake move, or null if there is no current fake move
   */
  fakeMove: MutableRefObject<FakeMove | null>;

  /**
   * The callbacks for when the fake move changes
   */
  onFakeMoveChanged: MutableRefObject<Callbacks<FakeMoveChangedEvent>>;
};
/**
 * Perfoms the fake move on the given stats, returning the new stats
 * @param stats The stats to perform the fake move on
 * @param fakeMove The fake move to perform, or null if there is no fake move
 * @returns The new stats
 */
const correctWithFakeMove = (
  stats: Map<number, number>,
  fakeMove: FakeMove | null
): Map<number, number> => {
  if (fakeMove === null) {
    return stats;
  }

  const newStats = new Map(stats);
  fakeMove.deltas.forEach((delta, value) => {
    const newValue = (newStats.get(value) ?? 0) + delta;
    newStats.set(value, newValue);
  });
  return newStats;
};

type _FakeMoveInfo = {
  /**
   * If we are lowering the value of one option by 1, the option whose
   * value we are lowering. Otherwise, null.
   */
  lowering: NumericPromptSelection | null;
  /**
   * If lowering's total falls to or below this value, we remove the lowering
   * effect. Otherwise, null.
   */
  loweringUpperTrigger: number | null;
  /**
   * If we are raising the value of one option by 1, the option whose
   * value we are raising. Otherwise, null.
   */
  raising: NumericPromptSelection | null;
  /**
   * If raising's total rises to or above this value, we remove the raising
   * effect. Otherwise, null.
   */
  raisingLowerTrigger: number | null;
  /**
   * The time at which we should remove the fake move regardless of the triggers
   */
  promptTimeToCancel: number;
};

/**
 * In order to improve ui responsiveness, it's necessary to predict how the stats will
 * change immediately after the user makes a selection, until it's reflected in the
 * server's stats. This hook returns the client-side changes that should be applied to
 * the stats prior to display.
 *
 * @param promptTime The prompt time, to remove fake moves that are no longer relevant
 * @param stats The stats, used to dissipate fake moves at an intelligent time
 * @param selection The selection, used to trigger fake moves
 */
const useFakeMove = (
  promptTime: PromptTime,
  stats: PromptStats,
  selection: NumericPromptSelectionRef
): FakeMoveRef => {
  const fakeMove = useRef<FakeMove | null>(null);
  const onFakeMoveChanged = useRef<Callbacks<FakeMoveChangedEvent>>() as MutableRefObject<
    Callbacks<FakeMoveChangedEvent>
  >;

  if (onFakeMoveChanged.current === undefined) {
    onFakeMoveChanged.current = new Callbacks<FakeMoveChangedEvent>();
  }

  useEffect(() => {
    let info: _FakeMoveInfo | null = null;
    if (fakeMove.current !== null) {
      const old = fakeMove.current;
      fakeMove.current = null;
      onFakeMoveChanged.current.call({
        old,
        current: null,
      });
    }

    selection.onSelectionChanged.current.add(onSelectionEvent);
    promptTime.onTimeChanged.current.add(onTimeEvent);
    stats.onStatsChanged.current.add(onStatsEvent);
    return () => {
      selection.onSelectionChanged.current.remove(onSelectionEvent);
      promptTime.onTimeChanged.current.remove(onTimeEvent);
      stats.onStatsChanged.current.remove(onStatsEvent);
    };

    function onSelectionEvent(event: NumericPromptSelectionChangedEvent) {
      info = {
        lowering: null,
        loweringUpperTrigger: null,
        raising: event.current,
        raisingLowerTrigger: (stats.stats.current.numericActive?.get(event.current.value) ?? 0) + 1,
        promptTimeToCancel: promptTime.time.current + 1500,
      };

      if (event.old) {
        const oldNum = stats.stats.current.numericActive?.get(event.old.value) ?? 0;
        if (oldNum > 0) {
          info.lowering = event.old;
          info.loweringUpperTrigger = oldNum - 1;
        }
      }

      updateDeltas();
    }

    function onTimeEvent(event: PromptTimeEvent) {
      if (!info) {
        return;
      }

      if (event.current >= info.promptTimeToCancel) {
        info = null;
        updateDeltas();
      }
    }

    function onStatsEvent(event: StatsChangedEvent) {
      if (!info) {
        return;
      }

      let changed = false;

      if (
        info.lowering !== null &&
        info.loweringUpperTrigger !== null &&
        (event.current.numericActive?.get(info.lowering.value) ?? 0) <= info.loweringUpperTrigger
      ) {
        info.lowering = null;
        info.loweringUpperTrigger = null;
        changed = true;
      }

      if (
        info.raising !== null &&
        info.raisingLowerTrigger !== null &&
        (event.current.numericActive?.get(info.raising.value) ?? 0) >= info.raisingLowerTrigger
      ) {
        info.raising = null;
        info.raisingLowerTrigger = null;
        changed = true;
      }

      if (info.lowering === null && info.raising === null) {
        info = null;
        changed = true;
      }

      if (changed) {
        updateDeltas();
      }
    }

    function updateDeltas() {
      if (info === null) {
        if (fakeMove.current === null) {
          return;
        }

        const old = fakeMove.current;
        fakeMove.current = null;
        onFakeMoveChanged.current.call({
          old,
          current: null,
        });
        return;
      }

      const deltas = new Map<number, number>();
      if (info.lowering !== null) {
        deltas.set(info.lowering.value, -1);
      }
      if (info.raising !== null) {
        deltas.set(info.raising.value, 1);
      }

      const old = fakeMove.current;
      fakeMove.current = {
        deltas,
      };
      onFakeMoveChanged.current.call({
        old,
        current: fakeMove.current,
      });
    }
  }, [promptTime, selection, stats]);

  return useMemo(
    () => ({
      fakeMove,
      onFakeMoveChanged,
    }),
    []
  );
};

/**
 * When the user changes their selection this hook will store the appropriate
 * event on the server
 */
const useStoreEvents = (
  prompt: InteractivePrompt,
  promptTime: PromptTime,
  selection: NumericPromptSelectionRef,
  loginContext: LoginContextValue
) => {
  useEffect(() => {
    const cancelers = new Callbacks<undefined>();
    let lastEventAt = 0;
    let eventCounter = 0;

    selection.onSelectionChanged.current.add(onSelectionEvent);
    return () => {
      selection.onSelectionChanged.current.remove(onSelectionEvent);
      cancelers.call(undefined);
    };

    async function onSelectionEvent(event: NumericPromptSelectionChangedEvent) {
      if (
        event.current === event.old ||
        (event.current !== null && event.old !== null && event.current.value === event.old.value)
      ) {
        return;
      }

      const id = ++eventCounter;

      let now = promptTime.time.current;
      if (now <= lastEventAt) {
        const promise = waitUntilUsingPromptTimeCancelable(
          promptTime,
          (event) => event.current > lastEventAt || eventCounter !== id
        );
        const doCancel = () => promise.cancel();
        cancelers.add(doCancel);
        try {
          await promise.promise;
        } catch (e) {
          return;
        } finally {
          cancelers.remove(doCancel);
        }

        if (eventCounter !== id) {
          return;
        }
        now = promptTime.time.current;
        lastEventAt = now;
      }

      if (now >= prompt.durationSeconds * 1000 - 250) {
        return;
      }

      await apiFetch(
        '/api/1/interactive_prompts/events/respond_numeric_prompt',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            interactive_prompt_uid: prompt.uid,
            interactive_prompt_jwt: prompt.jwt,
            session_uid: prompt.sessionUid,
            prompt_time: now / 1000,
            data: {
              rating: event.current.value,
            },
          }),
          keepalive: true,
        },
        loginContext
      );
    }
  }, [promptTime, selection, prompt, loginContext]);
};
