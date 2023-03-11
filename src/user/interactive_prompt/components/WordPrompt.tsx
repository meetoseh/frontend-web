import { MutableRefObject, ReactElement, useContext, useEffect, useMemo, useRef } from 'react';
import {
  PromptTime,
  PromptTimeEvent,
  usePromptTime,
  waitUntilUsingPromptTimeCancelable,
} from '../hooks/usePromptTime';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownText, CountdownTextConfig } from './CountdownText';
import {
  FilledWidthChangedEvent,
  HorizontalPartlyFilledRoundedRect,
} from './HorizontalPartlyFilledRoundedRect';
import { WordPrompt as WordPromptType } from '../models/Prompt';
import styles from './WordPrompt.module.css';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { PromptStats, StatsChangedEvent, useStats } from '../hooks/useStats';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext, LoginContextValue } from '../../../shared/LoginContext';
import { useJoinLeave } from '../hooks/useJoinLeave';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { ProfilePictures } from './ProfilePictures';

type WordPromptProps = {
  /**
   * The prompt to display. Must be a word prompt.
   */
  prompt: InteractivePrompt;

  /**
   * The function to call when the user finishes the prompt.
   */
  onFinished: () => void;

  /**
   * If specified, the function to call when the user selects a response.
   * @param response The value of the option the user selected.
   */
  onResponse?: (response: string) => void;

  /**
   * If specified, a countdown is displayed using the given props.
   */
  countdown?: CountdownTextConfig;
};

const unfilledColor: [number, number, number, number] = [68 / 255, 98 / 255, 102 / 255, 0.4];
const filledColor: [number, number, number, number] = [68 / 255, 98 / 255, 102 / 255, 0.9];

export const WordPrompt = ({
  prompt: intPrompt,
  onFinished,
  onResponse,
  countdown,
}: WordPromptProps): ReactElement => {
  if (intPrompt.prompt.style !== 'word') {
    throw new Error('WordPrompt must be given a word prompt');
  }
  const prompt = intPrompt.prompt as WordPromptType;
  const promptTime = usePromptTime(-250, false);
  const stats = useStats({ prompt: intPrompt, promptTime });
  const selection = useSelection();
  const screenSize = useWindowSize();
  const fakeMove = useFakeMove(promptTime, stats, selection);
  const profilePictures = useProfilePictures({ prompt: intPrompt, promptTime, stats });
  const loginContext = useContext(LoginContext);
  useJoinLeave({ prompt: intPrompt, promptTime });
  useStoreEvents(intPrompt, promptTime, selection, loginContext);

  useEffect(() => {
    const promptDurationMs = intPrompt.durationSeconds * 1000;
    if (promptTime.time.current >= promptDurationMs) {
      onFinished();
      return;
    }

    const promise = waitUntilUsingPromptTimeCancelable(
      promptTime,
      (event) => event.current >= promptDurationMs
    );
    promise.promise
      .then(() => {
        onFinished();
      })
      .catch(() => {});
    return () => promise.cancel();
  }, [promptTime, intPrompt, onFinished]);

  const boundFilledWidthGetterSetters: {
    get: () => number;
    set: (v: number) => void;
    callbacks: () => Callbacks<FilledWidthChangedEvent>;
  }[] = useMemo(() => {
    return prompt.options.map(() => {
      let width = 0;
      const callbacks = new Callbacks<FilledWidthChangedEvent>();
      return {
        get: () => width,
        set: (v: number) => {
          width = v;
        },
        callbacks: () => callbacks,
      };
    });
  }, [prompt]);

  useEffect(() => {
    let lastCorrectedStats: number[] | null = null;
    stats.onStatsChanged.current.add(updateWidths);
    fakeMove.onFakeMoveChanged.current.add(updateWidths);
    return () => {
      stats.onStatsChanged.current.remove(updateWidths);
      fakeMove.onFakeMoveChanged.current.remove(updateWidths);
    };

    function updateWidths() {
      const wordActive = stats.stats.current.wordActive;
      if (!wordActive) {
        return;
      }

      const correctedStats = correctWithFakeMove(wordActive, fakeMove.fakeMove.current);
      if (
        lastCorrectedStats !== null &&
        lastCorrectedStats.length === correctedStats.length &&
        lastCorrectedStats.every((v, idx) => v === correctedStats[idx])
      ) {
        return;
      }
      lastCorrectedStats = correctedStats;
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
        boundFilledWidthGetterSetters[idx].callbacks().call({
          old,
          current: fractional,
        });
      });
    }
  }, [stats, fakeMove, boundFilledWidthGetterSetters]);

  const optionWidth = Math.min(390, Math.min(screenSize.width, 440) - 48);

  return (
    <div className={styles.container}>
      {countdown && <CountdownText promptTime={promptTime} prompt={intPrompt} {...countdown} />}
      <div className={styles.prompt}>
        <div className={styles.promptInfo}>
          <div className={styles.subtitle}>Class Poll</div>
          <div className={styles.title}>{prompt.text}</div>
        </div>
        <div className={styles.options}>
          {prompt.options.map((option, idx) => {
            return (
              <div key={idx} className={styles.option} style={{ width: optionWidth, height: 54 }}>
                <div className={styles.optionBackground}>
                  <HorizontalPartlyFilledRoundedRect
                    height={54}
                    width={optionWidth}
                    unfilledColor={unfilledColor}
                    borderRadius={10}
                    filledColor={filledColor}
                    filledWidth={boundFilledWidthGetterSetters[idx].get}
                    onFilledWidthChanged={boundFilledWidthGetterSetters[idx].callbacks}
                  />
                </div>
                <button
                  className={styles.optionForeground}
                  style={{ width: optionWidth, height: 54 }}
                  onClick={() => {
                    if (selection.selection.current === idx) {
                      return;
                    }

                    const oldSelection = selection.selection.current;
                    selection.selection.current = idx;
                    selection.onSelectionChanged.current.call({
                      old: oldSelection,
                      current: idx,
                    });

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
        <div className={styles.profilePictures}>
          <ProfilePictures profilePictures={profilePictures} />
        </div>
      </div>
    </div>
  );
};

/**
 * The event that we use for callbacks when the user changes their selection
 */
type SelectionChangedEvent = {
  /**
   * The index of the old selection, or null if there was no old selection
   */
  old: number | null;

  /**
   * The index of the new selection
   */
  current: number;
};

type WordPromptSelectionRef = {
  /**
   * The index of the currently selected option, or null if no option is selected
   */
  selection: MutableRefObject<number | null>;

  /**
   * The callbacks for when the selection changed
   */
  onSelectionChanged: MutableRefObject<Callbacks<SelectionChangedEvent>>;
};

const useSelection = (): WordPromptSelectionRef => {
  const selection = useRef<number | null>(null);
  const onSelectionChanged = useRef<Callbacks<SelectionChangedEvent>>() as MutableRefObject<
    Callbacks<SelectionChangedEvent>
  >;

  if (onSelectionChanged.current === undefined) {
    onSelectionChanged.current = new Callbacks<SelectionChangedEvent>();
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
 * Shows a checkmark which is checked if the selection matches the
 * given index, and unchecked otherwise, without triggering react
 * state updates.
 */
const CheckmarkFromSelection = ({
  index,
  selection,
}: {
  index: number;
  selection: WordPromptSelectionRef;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isChecked: boolean | null = null;
    selection.onSelectionChanged.current.add(onEvent);
    return () => {
      selection.onSelectionChanged.current.remove(onEvent);
    };

    function onEvent(event: SelectionChangedEvent) {
      const isNowChecked = event.current === index;
      if (isChecked !== isNowChecked && containerRef.current) {
        containerRef.current.classList.toggle(styles.checkmarkContainerChecked, isNowChecked);
      }
    }
  }, [index, selection]);

  return (
    <div
      ref={containerRef}
      className={`${styles.checkmarkContainer} ${
        index === selection.selection.current ? styles.checkmarkContainerChecked : ''
      }`}>
      <div className={styles.checkmark} />
    </div>
  );
};

type FakeMove = {
  /**
   * The amount that we should modify the stats by prior to presenting
   * them in order to account for the fake move, in index-correspondance
   * with prompt.options.
   */
  deltas: number[];
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
const correctWithFakeMove = (stats: number[], fakeMove: FakeMove | null): number[] => {
  if (fakeMove === null) {
    return stats;
  }

  return stats.map((stat, idx) => stat + fakeMove.deltas[idx]);
};

type _FakeMoveInfo = {
  /**
   * If we are lowering the value of one option by 1, the index of the option whose
   * value we are lowering. Otherwise, null.
   */
  loweringIndex: number | null;
  /**
   * If loweringIndex's total falls to or below this value, we remove the lowering
   * effect. Otherwise, null.
   */
  loweringIndexUpperTrigger: number | null;
  /**
   * If we are raising the value of one option by 1, the index of the option whose
   * value we are raising. Otherwise, null.
   */
  raisingIndex: number | null;
  /**
   * If raisingIndex's total rises to or above this value, we remove the raising
   * effect. Otherwise, null.
   */
  raisingIndexLowerTrigger: number | null;
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
  selection: WordPromptSelectionRef
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

    function onSelectionEvent(event: SelectionChangedEvent) {
      info = {
        loweringIndex: null,
        loweringIndexUpperTrigger: null,
        raisingIndex: event.current,
        raisingIndexLowerTrigger: (stats.stats.current.wordActive?.[event.current] ?? 0) + 1,
        promptTimeToCancel: promptTime.time.current + 1500,
      };

      if (event.old) {
        const oldNum = stats.stats.current.wordActive?.[event.old] ?? 0;
        if (oldNum > 0) {
          info.loweringIndex = event.old;
          info.loweringIndexUpperTrigger = oldNum - 1;
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
        info.loweringIndex !== null &&
        info.loweringIndexUpperTrigger !== null &&
        (event.current.wordActive?.[info.loweringIndex] ?? 0) <= info.loweringIndexUpperTrigger
      ) {
        info.loweringIndex = null;
        info.loweringIndexUpperTrigger = null;
        changed = true;
      }

      if (
        info.raisingIndex !== null &&
        info.raisingIndexLowerTrigger !== null &&
        (event.current.wordActive?.[info.raisingIndex] ?? 0) >= info.raisingIndexLowerTrigger
      ) {
        info.raisingIndex = null;
        info.raisingIndexLowerTrigger = null;
        changed = true;
      }

      if (info.loweringIndex !== null && info.raisingIndex !== null) {
        info = null;
        changed = true;
      }

      if (changed) {
        updateDeltas();
      }
    }

    function updateDeltas() {
      const deltas = [];
      const wordActive = stats.stats.current.wordActive;
      if (wordActive) {
        for (let i = 0; i < wordActive.length; i++) {
          if (info?.loweringIndex === i) {
            deltas.push(-1);
          } else if (info?.raisingIndex === i) {
            deltas.push(1);
          } else {
            deltas.push(0);
          }
        }
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
  selection: WordPromptSelectionRef,
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

    async function onSelectionEvent(event: SelectionChangedEvent) {
      if (event.current === event.old) {
        return;
      }

      const id = ++eventCounter;

      let now = promptTime.time.current;
      if (now <= lastEventAt) {
        const promise = waitUntilUsingPromptTimeCancelable(
          promptTime,
          (event) => event.current > lastEventAt || eventCounter !== id
        );
        cancelers.add(() => promise.cancel());
        try {
          await promise.promise;
        } catch (e) {
          return;
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
        '/api/1/interactive_prompts/events/respond_word_prompt',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            interactive_prompt_uid: prompt.uid,
            interactive_prompt_jwt: prompt.jwt,
            session_uid: prompt.sessionUid,
            prompt_time: now / 1000,
            data: {
              index: event.current,
            },
          }),
          keepalive: true,
        },
        loginContext
      );
    }
  }, [promptTime, selection, prompt, loginContext]);
};