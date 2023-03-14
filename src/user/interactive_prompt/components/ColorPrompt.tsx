import { MutableRefObject, ReactElement, useContext, useEffect, useMemo, useRef } from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownText, CountdownTextConfig } from './CountdownText';
import styles from './ColorPrompt.module.css';
import { ColorPrompt as ColorPromptType } from '../models/Prompt';
import { PromptTime, PromptTimeEvent, usePromptTime } from '../hooks/usePromptTime';
import { PromptStats, StatsChangedEvent, useStats } from '../hooks/useStats';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { LoginContext, LoginContextValue } from '../../../shared/LoginContext';
import { ProfilePictures } from './ProfilePictures';
import { JoinLeave, useJoinLeave } from '../hooks/useJoinLeave';
import { useOnFinished } from '../hooks/useOnFinished';
import { Callbacks } from '../../../shared/lib/Callbacks';
import {
  SimpleSelectionChangedEvent,
  SimpleSelectionRef,
  useSimpleSelection,
} from '../hooks/useSimpleSelection';
import { apiFetch } from '../../../shared/ApiConstants';
import { useSimpleSelectionHandler } from '../hooks/useSimpleSelectionHandler';
import {
  VerticalPartlyFilledRoundedRect,
  VPFRRState,
  VPFRRStateChangedEvent,
} from './VerticalPartlyFilledRoundedRect';
import { getColor3fFromHex } from '../../../shared/lib/BezierAnimation';

type ColorPromptProps = {
  /**
   * The prompt to display. Must be a color prompt.
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

const colorInactiveOpacity = 0.4;
const colorActiveOpacity = 1.0;

const colorForegroundOpacity = 1.0;
const colorBackgroundOpacity = 0.4;

/**
 * Displays an color interactive prompt, where users can select a color and
 * see what colors other users have selected.
 */
export const ColorPrompt = ({
  prompt: intPrompt,
  onFinished,
  countdown,
  subtitle,
  paused,
}: ColorPromptProps): ReactElement => {
  if (intPrompt.prompt.style !== 'color') {
    throw new Error('ColorPrompt must be given a color prompt');
  }
  const prompt = intPrompt.prompt as ColorPromptType;
  const promptTime = usePromptTime(-250, paused ?? false);
  const stats = useStats({ prompt: intPrompt, promptTime });
  const selection = useSimpleSelection<number>();
  const screenSize = useWindowSize();
  const fakeMove = useFakeMove(promptTime, stats, selection);
  const profilePictures = useProfilePictures({ prompt: intPrompt, promptTime, stats });
  const loginContext = useContext(LoginContext);
  const joinLeave = useJoinLeave({ prompt: intPrompt, promptTime });
  useStoreEvents(intPrompt, promptTime, selection, joinLeave, loginContext);
  useOnFinished(intPrompt, promptTime, onFinished);

  const colorsContainerWidth = Math.min(390, Math.min(screenSize.width, 440) - 64);
  const colorsGapPx = 32;
  const colorsMaxWidthPx = 48;
  const colorsHeightPx = 128;

  const colorToIndex = useMemo(() => {
    const lookup = new Map<string, number>();
    for (let i = 0; i < prompt.colors.length; i++) {
      lookup.set(prompt.colors[i], i);
    }
    return lookup;
  }, [prompt]);

  const colorRows: string[][] = useMemo(() => {
    const colors = prompt.colors;
    if (colors.length <= 4) {
      return [colors];
    }

    const columns = Math.ceil(colors.length / 2);
    const rows: string[][] = [];
    let row: string[] = [];
    for (let i = 0; i < colors.length; i++) {
      row.push(colors[i]);
      if (row.length === columns) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length > 0) {
      rows.push(row);
    }
    return rows;
  }, [prompt.colors]);

  const rowHeight = (colorsHeightPx - (colorRows.length - 1) * colorsGapPx) / colorRows.length;

  const itemWidth = useMemo(() => {
    let width = colorsMaxWidthPx;

    for (let rowIndex = 0; rowIndex < colorRows.length; rowIndex++) {
      const row = colorRows[rowIndex];
      const naturalWidth = (colorsContainerWidth - (row.length - 1) * colorsGapPx) / row.length;
      width = Math.min(naturalWidth, colorsMaxWidthPx);
    }

    return width;
  }, [colorRows, colorsContainerWidth]);

  const trueColorsWidth = useMemo(() => {
    const maxItemsPerRow = Math.max(...colorRows.map((row) => row.length));
    return maxItemsPerRow * itemWidth + (maxItemsPerRow - 1) * colorsGapPx;
  }, [colorRows, itemWidth]);

  const colorStates = useMemo(() => {
    const result: {
      get: () => VPFRRState;
      set: (state: VPFRRState) => void;
      callbacks: () => Callbacks<VPFRRStateChangedEvent>;
    }[] = [];
    for (let outerIndex = 0; outerIndex < prompt.colors.length; outerIndex++) {
      (() => {
        let state: VPFRRState = {
          opacity: colorInactiveOpacity,
          filledHeight: 0.5,
        };
        const callbacks = new Callbacks<VPFRRStateChangedEvent>();

        result.push({
          get: () => state,
          set: (newState) => {
            const old = state;
            state = newState;
            callbacks.call({ old, current: newState });
          },
          callbacks: () => callbacks,
        });
      })();
    }
    return result;
  }, [prompt]);

  // manages the opacity on the options
  useEffect(() => {
    selection.onSelectionChanged.current.add(handleEvent);
    return () => {
      selection.onSelectionChanged.current.remove(handleEvent);
    };

    function handleEvent(event: SimpleSelectionChangedEvent<number>) {
      if (event.current === event.old) {
        return;
      }

      if (event.old !== null) {
        colorStates[event.old].set(
          Object.assign({}, colorStates[event.old].get(), { opacity: colorInactiveOpacity })
        );
      }
      colorStates[event.current].set(
        Object.assign({}, colorStates[event.current].get(), { opacity: colorActiveOpacity })
      );
    }
  }, [selection, colorStates]);

  // manages the height on the options
  useEffect(() => {
    stats.onStatsChanged.current.add(update);
    fakeMove.onFakeMoveChanged.current.add(update);
    update();
    return () => {
      stats.onStatsChanged.current.remove(update);
      fakeMove.onFakeMoveChanged.current.remove(update);
    };

    function update() {
      if (stats.stats.current.colorActive === null) {
        return;
      }

      const newCorrectedStats = correctWithFakeMove(
        stats.stats.current.colorActive,
        fakeMove.fakeMove.current
      );

      const total = newCorrectedStats.reduce((a, b) => a + b, 0);
      const fractionals =
        total === 0
          ? newCorrectedStats.map(() => 0)
          : newCorrectedStats.map((colAmt) => {
              return colAmt / total;
            });
      fractionals.forEach((fractional, index) => {
        const old = colorStates[index].get();

        if (old.filledHeight !== fractional) {
          colorStates[index].set(Object.assign({}, old, { filledHeight: fractional }));
        }
      });
    }
  }, [stats, fakeMove, colorStates]);

  return (
    <div className={styles.container}>
      {countdown && <CountdownText promptTime={promptTime} prompt={intPrompt} {...countdown} />}
      <div className={styles.prompt}>
        <div className={styles.colors}>
          {colorRows.map((row, rowIndex) => (
            <div key={rowIndex} className={styles.colorRow} style={{ height: `${rowHeight}px` }}>
              {row.map((color, colIndex) => (
                <button
                  key={`${color}-${colIndex}`}
                  className={styles.color}
                  onClick={() => {
                    const old = selection.selection.current;
                    const clicked = colorToIndex.get(color)!;
                    if (old === clicked) {
                      return;
                    }
                    selection.selection.current = clicked;
                    selection.onSelectionChanged.current.call({ old, current: clicked });
                  }}
                  style={{ width: `${itemWidth}px` }}>
                  <VerticalPartlyFilledRoundedRect
                    height={rowHeight}
                    width={itemWidth}
                    unfilledColor={addOpacity(color, colorBackgroundOpacity)}
                    borderRadius={Math.ceil(Math.min(itemWidth, rowHeight) * 0.1)}
                    filledColor={addOpacity(color, colorForegroundOpacity)}
                    state={colorStates[colorToIndex.get(color)!].get}
                    onStateChanged={colorStates[colorToIndex.get(color)!].callbacks}
                    border={{ width: 2, color: addOpacity(color, 1.0) }}
                  />
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.profilePictures} style={{ width: `${trueColorsWidth}px` }}>
          <ProfilePictures profilePictures={profilePictures} />
        </div>
      </div>
    </div>
  );
};

type FakeMove = {
  /**
   * The amount that we should modify the stats by prior to presenting
   * them in order to account for the fake move, in index-correspondance
   * with prompt.colors.
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
   * If we are lowering the value of one color by 1, the index of the color whose
   * value we are lowering. Otherwise, null.
   */
  loweringIndex: number | null;
  /**
   * If loweringIndex's total falls to or below this value, we remove the lowering
   * effect. Otherwise, null.
   */
  loweringIndexUpperTrigger: number | null;
  /**
   * If we are raising the value of one color by 1, the index of the color whose
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
  selection: SimpleSelectionRef<number>
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

    function onSelectionEvent(event: SimpleSelectionChangedEvent<number>) {
      info = {
        loweringIndex: null,
        loweringIndexUpperTrigger: null,
        raisingIndex: event.current,
        raisingIndexLowerTrigger: (stats.stats.current.colorActive?.[event.current] ?? 0) + 1,
        promptTimeToCancel: promptTime.time.current + 1500,
      };

      if (event.old) {
        const oldNum = stats.stats.current.colorActive?.[event.old] ?? 0;
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
        (event.current.colorActive?.[info.loweringIndex] ?? 0) <= info.loweringIndexUpperTrigger
      ) {
        info.loweringIndex = null;
        info.loweringIndexUpperTrigger = null;
        changed = true;
      }

      if (
        info.raisingIndex !== null &&
        info.raisingIndexLowerTrigger !== null &&
        (event.current.colorActive?.[info.raisingIndex] ?? 0) >= info.raisingIndexLowerTrigger
      ) {
        info.raisingIndex = null;
        info.raisingIndexLowerTrigger = null;
        changed = true;
      }

      if (info.loweringIndex === null && info.raisingIndex === null) {
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

      const deltas = [];
      const colorActive = stats.stats.current.colorActive;
      if (colorActive) {
        for (let i = 0; i < colorActive.length; i++) {
          if (info.loweringIndex === i) {
            deltas.push(-1);
          } else if (info.raisingIndex === i) {
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
  selection: SimpleSelectionRef<number>,
  joinLeave: JoinLeave,
  loginContext: LoginContextValue
) => {
  const handler = async (index: number, time: number) => {
    await apiFetch(
      '/api/1/interactive_prompts/events/respond_color_prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          interactive_prompt_uid: prompt.uid,
          interactive_prompt_jwt: prompt.jwt,
          session_uid: prompt.sessionUid,
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

/**
 * Takes a hex string and converts it to [r, g, b, a] as 0-1 floats by adding
 * the given opacity
 *
 * @param hex The hex string, e.g., #ff0000
 * @param opacity The opacity, 0-1, e.g., 0.5
 * @returns [r, g, b, a] as 0-1 floats, e.g., [1, 0, 0, 0.5]
 */
const addOpacity = (hex: string, opacity: number): [number, number, number, number] => {
  const rgb = getColor3fFromHex(hex);
  return [rgb[0], rgb[1], rgb[2], opacity];
};
