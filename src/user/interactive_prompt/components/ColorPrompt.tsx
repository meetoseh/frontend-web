import { MutableRefObject, ReactElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownText, CountdownTextConfig } from './CountdownText';
import styles from './ColorPrompt.module.css';
import { ColorPrompt as ColorPromptType } from '../models/Prompt';
import { PromptTime, usePromptTime } from '../hooks/usePromptTime';
import { Stats, useStats } from '../hooks/useStats';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { LoginContext, LoginContextValue } from '../../../shared/contexts/LoginContext';
import { ProfilePictures } from './ProfilePictures';
import { JoinLeave, useJoinLeave } from '../hooks/useJoinLeave';
import { useOnFinished } from '../hooks/useOnFinished';
import { Callbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import {
  SimpleSelectionChangedEvent,
  SimpleSelectionRef,
  useSimpleSelection,
  useSimpleSelectionHasSelection,
} from '../hooks/useSimpleSelection';
import { apiFetch } from '../../../shared/ApiConstants';
import { useSimpleSelectionHandler } from '../hooks/useSimpleSelectionHandler';
import { getColor3fFromHex } from '../../../shared/lib/BezierAnimation';
import { PromptTitle } from './PromptTitle';
import { Button } from '../../../shared/forms/Button';
import {
  VPFRRProps,
  VerticalPartlyFilledRoundedRect,
} from '../../../shared/anim/VerticalPartlyFilledRoundedRect';
import { useIndexableFakeMove } from '../hooks/useIndexableFakeMove';

type ColorPromptProps = {
  /**
   * The prompt to display. Must be a color prompt.
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

const colorInactiveOpacity = 0.4;
const colorActiveOpacity = 1.0;

const colorForegroundOpacity = 1.0;
const colorBackgroundOpacity = 0.4;

const getResponses = (stats: Stats): number[] | undefined => stats.colorActive ?? undefined;

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
  finishEarly,
  titleMaxWidth,
  leavingCallback,
}: ColorPromptProps): ReactElement => {
  if (intPrompt.prompt.style !== 'color') {
    throw new Error('ColorPrompt must be given a color prompt');
  }
  const prompt = intPrompt.prompt as ColorPromptType;
  const promptTime = usePromptTime(-250, paused ?? false);
  const stats = useStats({ prompt: intPrompt, promptTime });
  const selection = useSimpleSelection<number>();
  const hasSelection = useSimpleSelectionHasSelection(selection);
  const screenSize = useWindowSize();
  const clientPredictedStats = useWritableValueWithCallbacks<number[]>([]);
  const profilePictures = useProfilePictures({ prompt: intPrompt, promptTime, stats });
  const loginContext = useContext(LoginContext);
  const joinLeave = useJoinLeave({ prompt: intPrompt, promptTime });
  useIndexableFakeMove({
    getResponses,
    promptTime,
    promptStats: stats,
    selection,
    clientPredictedStats,
  });
  useStoreEvents(intPrompt, promptTime, selection, joinLeave, loginContext);
  useOnFinished(intPrompt, promptTime, onFinished);
  const windowSize = useWindowSize();

  leavingCallback.current = () => {
    joinLeave.leaving.current = true;
  };

  const handleSkip = useCallback(() => {
    leavingCallback.current?.();
    onFinished(true);
  }, [onFinished, leavingCallback]);

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
      get: () => VPFRRProps;
      set: (state: VPFRRProps) => void;
      callbacks: Callbacks<undefined>;
    }[] = [];
    for (let outerIndex = 0; outerIndex < prompt.colors.length; outerIndex++) {
      (() => {
        const color = prompt.colors[outerIndex];
        let state: VPFRRProps = {
          filledHeight: 0.5,
          borderRadius: Math.ceil(Math.min(itemWidth, rowHeight) * 0.1),
          unfilledColor: addOpacity(color, colorBackgroundOpacity),
          filledColor: addOpacity(color, colorForegroundOpacity),
          opacity: colorInactiveOpacity,
          border: { width: 2 },
        };
        const callbacks = new Callbacks<undefined>();

        result.push({
          get: () => state,
          set: (newState) => {
            state = newState;
            callbacks.call(undefined);
          },
          callbacks,
        });
      })();
    }
    return result;
  }, [prompt, itemWidth, rowHeight]);

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
    clientPredictedStats.callbacks.add(update);
    update();
    return () => {
      clientPredictedStats.callbacks.remove(update);
    };

    function update() {
      const newCorrectedStats = clientPredictedStats.get();
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
  }, [clientPredictedStats, colorStates]);

  return (
    <div className={styles.container}>
      {countdown && <CountdownText promptTime={promptTime} prompt={intPrompt} {...countdown} />}
      <div className={styles.prompt}>
        <PromptTitle text={prompt.text} subtitle={subtitle} titleMaxWidth={titleMaxWidth} />
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
                    props={{
                      type: 'callbacks',
                      props: () => colorStates[colorToIndex.get(color)!].get(),
                      callbacks: colorStates[colorToIndex.get(color)!].callbacks,
                    }}
                    height={rowHeight}
                    width={itemWidth}
                  />
                </button>
              ))}
            </div>
          ))}
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
          style={
            finishEarly ? {} : { width: `${trueColorsWidth}px`, padding: '0', alignSelf: 'center' }
          }>
          <ProfilePictures profilePictures={profilePictures} />
        </div>
      </div>
    </div>
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
