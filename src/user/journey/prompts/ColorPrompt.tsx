import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { JourneyPromptProps } from '../models/JourneyPromptProps';
import styles from './ColorPrompt.module.css';

export const ColorPrompt = ({
  journeyUid,
  journeyJwt,
  sessionUid,
  prompt,
  journeyDurationSeconds,
  stats,
  journeyTime,
  loginContext,
}: JourneyPromptProps): ReactElement => {
  if (prompt.style !== 'color') {
    throw new Error('Invalid prompt style');
  }

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // we want pressing the button to immediately react, but stats won't come in
  // for a second or so, so we alter the stats temporarily
  const [fakingMove, setFakingMove] = useState<FakedMove | null>(null);

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

  const onChooseColor = useCallback(
    async (color: string) => {
      const index = prompt.colors.indexOf(color);
      if (index < 0) {
        return;
      }
      if (activeIndex === index) {
        return;
      }

      setFakingMove({
        fromIndex: activeIndex,
        toIndex: index,
        fakeEndsAt: journeyTime.time.current + 1500,
        cancelFakeToMin: stats.colorActive === null ? 1 : stats.colorActive[index] + 1,
      });
      setActiveIndex(index);

      if (loginContext.state !== 'logged-in') {
        console.log('not sending color prompt response because not logged in');
        return;
      }

      const now = journeyTime.time.current;
      if (now <= 250 || now >= journeyDurationSeconds * 1000 - 250) {
        console.log('not sending color prompt response; too close to start or end of journey');
        return;
      }

      try {
        const response = await apiFetch(
          '/api/1/journeys/events/respond_color_prompt',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyUid,
              journey_jwt: journeyJwt,
              session_uid: sessionUid,
              journey_time: now / 1000,
              data: {
                index: index,
              },
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('failed to send color prompt; could not connect to server:', e);
        } else if (e instanceof Response) {
          const data = await e.json();
          console.error('failed to send color prompt; server rejected request:', data);
        } else {
          console.error('failed to send color prompt; unknown error:', e);
        }
      }
    },
    [
      loginContext,
      journeyUid,
      journeyJwt,
      sessionUid,
      prompt.colors,
      journeyTime.time,
      journeyDurationSeconds,
      activeIndex,
      stats.colorActive,
    ]
  );

  // don't want to unmount faking move every time stats updates
  const colorActiveRef = useRef<number[] | null>(stats.colorActive);
  colorActiveRef.current = stats.colorActive;
  useEffect(() => {
    if (fakingMove === null) {
      return;
    }

    if (
      colorActiveRef.current !== null &&
      colorActiveRef.current[fakingMove.toIndex] >= fakingMove.cancelFakeToMin
    ) {
      setFakingMove(null);
      return;
    }

    if (journeyTime.time.current >= fakingMove.fakeEndsAt) {
      setFakingMove(null);
      return;
    }

    let active = true;
    const onTimeChange = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }

      if (
        newTime < fakingMove.fakeEndsAt &&
        (colorActiveRef.current === null ||
          colorActiveRef.current[fakingMove.toIndex] < fakingMove.cancelFakeToMin)
      ) {
        return;
      }

      setFakingMove(null);
      unmount();
    };

    const predictedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onTimeChange);

    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      for (
        let i = Math.min(predictedIndex, journeyTime.onTimeChanged.current.length);
        i >= 0;
        i--
      ) {
        if (journeyTime.onTimeChanged.current[i] === onTimeChange) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }
    };
    return unmount;
  }, [journeyTime.onTimeChanged, journeyTime.time, fakingMove]);

  const buttons = useMemo(() => {
    let colorActive =
      stats.colorActive === null ? Array(prompt.colors.length).fill(0) : stats.colorActive;

    if (fakingMove !== null) {
      colorActive = colorActive.slice();
      if (fakingMove.fromIndex !== null && colorActive[fakingMove.fromIndex] > 0) {
        colorActive[fakingMove.fromIndex]--;
      }
      colorActive[fakingMove.toIndex]++;
    }

    const totalResponses = colorActive.reduce((a, b) => a + b, 0);
    const percentageResponses = colorActive.map((count) =>
      totalResponses === 0 ? 0 : count / totalResponses
    );

    return colorRows.map((row, rowIndex) => (
      <div key={rowIndex} className={styles.colorRow}>
        {row.map((color, colorIndex) => {
          const isActive = activeIndex !== null && color === prompt.colors[activeIndex];
          return (
            <button
              key={colorIndex}
              className={`${styles.color} ${isActive ? styles.colorActive : ''}`}
              style={{ borderColor: color }}
              onClick={(e) => {
                e.preventDefault();
                onChooseColor(color);
              }}>
              <div
                className={styles.colorInner}
                style={{
                  backgroundColor: color,
                  height: `${percentageResponses[rowIndex * row.length + colorIndex] * 100}%`,
                }}></div>
            </button>
          );
        })}
      </div>
    ));
  }, [colorRows, onChooseColor, stats.colorActive, activeIndex, prompt.colors, fakingMove]);

  return (
    <div className={styles.container}>
      <div className={styles.prompt}>{prompt.text}</div>
      <div className={styles.colorsContainer}>{buttons}</div>
    </div>
  );
};

type FakedMove = {
  fromIndex: number | null;
  toIndex: number;

  fakeEndsAt: DOMHighResTimeStamp;
  cancelFakeToMin: number;
};
