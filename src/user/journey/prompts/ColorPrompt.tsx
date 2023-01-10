import { ReactElement, useCallback, useMemo, useState } from 'react';
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
    ]
  );

  const buttons = useMemo(() => {
    const colorActive =
      stats.colorActive === null ? Array(prompt.colors.length).fill(0) : stats.colorActive;
    const totalResponses = colorActive.reduce((a, b) => a + b, 0);
    const percentageResponses = colorActive.map((count) =>
      totalResponses === 0 ? 0 : count / totalResponses
    );

    return colorRows.map((row, rowIndex) => (
      <div key={rowIndex} className={styles.colorRow}>
        {row.map((color, colorIndex) => (
          <button
            key={colorIndex}
            className={`${styles.color} ${
              activeIndex !== null && color === prompt.colors[activeIndex] ? styles.colorActive : ''
            }`}
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
        ))}
      </div>
    ));
  }, [colorRows, onChooseColor, stats.colorActive, activeIndex]);

  return (
    <div className={styles.container}>
      <div className={styles.prompt}>{prompt.text}</div>
      <div className={styles.colorsContainer}>{buttons}</div>
    </div>
  );
};
