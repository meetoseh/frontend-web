import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { JourneyPromptProps } from '../models/JourneyPromptProps';
import styles from './WordPrompt.module.css';

export const WordPrompt = ({
  journeyUid,
  journeyJwt,
  sessionUid,
  prompt,
  journeyDurationSeconds,
  stats,
  journeyTime,
  loginContext,
}: JourneyPromptProps): ReactElement => {
  if (prompt.style !== 'word') {
    throw new Error('Invalid prompt style');
  }

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // we want pressing the button to immediately react, but stats won't come in
  // for a second or so, so we alter the stats temporarily
  const [fakingMove, setFakingMove] = useState<FakedMove | null>(null);

  const wordRows: string[][] = useMemo(() => {
    const words = prompt.options;
    if (words.length <= 3) {
      return [words];
    }

    const columns = Math.ceil(words.length / 2);
    const rows: string[][] = [];
    let row: string[] = [];
    for (let i = 0; i < words.length; i++) {
      row.push(words[i]);
      if (row.length === columns) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length > 0) {
      rows.push(row);
    }
    return rows;
  }, [prompt.options]);

  const onChooseWord = useCallback(
    async (word: string) => {
      const index = prompt.options.indexOf(word);
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
        cancelFakeToMin: stats.wordActive === null ? 1 : stats.wordActive[index] + 1,
      });
      setActiveIndex(index);

      if (loginContext.state !== 'logged-in') {
        console.log('not sending word prompt response because not logged in');
        return;
      }

      const now = journeyTime.time.current;
      if (now <= 250 || now >= journeyDurationSeconds * 1000 - 250) {
        console.log('not sending word prompt response; too close to start or end of journey');
        return;
      }

      try {
        const response = await apiFetch(
          '/api/1/journeys/events/respond_word_prompt',
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
          console.error('failed to send word prompt; could not connect to server:', e);
        } else if (e instanceof Response) {
          const data = await e.json();
          console.error('failed to send word prompt; server rejected request:', data);
        } else {
          console.error('failed to send word prompt; unknown error:', e);
        }
      }
    },
    [
      loginContext,
      journeyUid,
      journeyJwt,
      sessionUid,
      prompt.options,
      journeyTime.time,
      journeyDurationSeconds,
      activeIndex,
      stats.wordActive,
    ]
  );

  // don't want to unmount faking move every time stats updates
  const wordActiveRef = useRef<number[] | null>(stats.wordActive);
  wordActiveRef.current = stats.wordActive;
  useEffect(() => {
    if (fakingMove === null) {
      return;
    }

    if (
      wordActiveRef.current !== null &&
      wordActiveRef.current[fakingMove.toIndex] >= fakingMove.cancelFakeToMin
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
        (wordActiveRef.current === null ||
          wordActiveRef.current[fakingMove.toIndex] < fakingMove.cancelFakeToMin)
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
    let wordActive =
      stats.wordActive === null ? Array(prompt.options.length).fill(0) : stats.wordActive;

    if (fakingMove !== null) {
      wordActive = wordActive.slice();
      if (fakingMove.fromIndex !== null && wordActive[fakingMove.fromIndex] > 0) {
        wordActive[fakingMove.fromIndex]--;
      }
      wordActive[fakingMove.toIndex]++;
    }

    const totalResponses = wordActive.reduce((a, b) => a + b, 0);
    const percentageResponses = wordActive.map((count) =>
      totalResponses === 0 ? 0 : count / totalResponses
    );

    return wordRows.map((row, rowIndex) => (
      <div key={rowIndex} className={styles.wordRow}>
        {row.map((word, wordIndex) => (
          <button
            key={wordIndex}
            className={`${styles.word} ${
              activeIndex !== null && word === prompt.options[activeIndex] ? styles.wordActive : ''
            }`}
            onClick={(e) => {
              e.preventDefault();
              onChooseWord(word);
            }}>
            <div
              className={styles.wordInner}
              style={{
                height: `${percentageResponses[rowIndex * row.length + wordIndex] * 100}%`,
              }}></div>
            <div className={styles.wordText}>{word}</div>
          </button>
        ))}
      </div>
    ));
  }, [wordRows, onChooseWord, stats.wordActive, activeIndex, prompt.options, fakingMove]);

  return (
    <div className={styles.container}>
      <div className={styles.prompt}>{prompt.text}</div>
      <div className={styles.wordsContainer}>{buttons}</div>
    </div>
  );
};

type FakedMove = {
  fromIndex: number | null;
  toIndex: number;

  fakeEndsAt: DOMHighResTimeStamp;
  cancelFakeToMin: number;
};