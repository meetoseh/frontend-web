import { CSSProperties, Fragment, ReactElement, useEffect } from 'react';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { Emotion } from '../../../../../shared/models/Emotion';
import { useValuesWithCallbacksEffect } from '../../../../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../../../../shared/lib/setVWC';
import styles from './EmotionsPicker.module.css';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { useStyleVWC } from '../../../../../shared/hooks/useStyleVWC';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Allows the user to pick from the given emotions via a series of
 * horizontally scrollable rows. The number of rows is chosen to
 * approximately fill the available space.
 *
 * In order to decide the number of rows, the amount of height needs
 * to be known in javascript. This will use a combination of the hint
 * provided and the actual space.
 *
 * This MUST be rendered within a flex container (i.e., display: flex)
 * in the column direction. The returned element will always have some
 * combination of flex-grow, flex-shrink, and flex-basis set that it
 * will automatically size to the smaller of the tallest height it wants
 * and the height of the container. `expectedHeight` SHOULD be the
 * height that this container would get if it was configured to
 * consume as much space as possible without scrolling (i.e., flex-grow \
 * set to an infinite value).
 *
 * This component can handle if the expected height is off, but in
 * react native it may cause a 1-frame flicker
 */
export const EmotionsPicker = ({
  emotions: emotionsVWC,
  onTapEmotion,
  expectedHeight: expectedHeightVWC,
  contentWidth: contentWidthVWC,
  question,
}: {
  emotions: ValueWithCallbacks<Emotion[] | null>;
  onTapEmotion: (emotion: Emotion) => void;
  expectedHeight: ValueWithCallbacks<number>;
  contentWidth: ValueWithCallbacks<number>;
  question: string | null;
}): ReactElement => {
  const heightVWC = useWritableValueWithCallbacks(() => expectedHeightVWC.get());
  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([expectedHeightVWC, containerRef], () => {
    const eleRaw = containerRef.get();
    if (eleRaw === null) {
      setVWC(heightVWC, expectedHeightVWC.get());
      return undefined;
    }

    const ele = eleRaw;
    if (window.ResizeObserver) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setVWC(heightVWC, entry.contentRect.height);
          break;
        }
      });
      ro.observe(ele);
      return () => {
        ro.disconnect();
      };
    }

    const onResize = () => {
      setVWC(heightVWC, ele.clientHeight);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
    };
  });

  const questionHeightVWC = useWritableValueWithCallbacks<number>(() =>
    question === null ? 0 : 48
  );
  useEffect(() => {
    if (question === null) {
      setVWC(questionHeightVWC, 0);
    }
  }, [question, questionHeightVWC]);
  const questionRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValueWithCallbacksEffect(questionRef, (eleRaw) => {
    if (eleRaw === null) {
      return undefined;
    }

    const ele = eleRaw;
    if (window.ResizeObserver) {
      const ro = new ResizeObserver((entries) => {
        setVWC(questionHeightVWC, ele.clientHeight);
      });
      ro.observe(ele);
      return () => {
        ro.disconnect();
      };
    }

    const onResize = () => {
      setVWC(questionHeightVWC, ele.clientHeight);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
    };
  });

  const rowHeight = 60;
  const rowGap = 12;

  const numRowsVWC = useMappedValuesWithCallbacks([heightVWC, questionHeightVWC], () => {
    const questionLineHeight = questionHeightVWC.get();
    const h = heightVWC.get();
    return Math.max(Math.min(Math.floor((h - questionLineHeight) / (rowHeight + rowGap)), 4), 1);
  });
  const rowsVWC = useMappedValuesWithCallbacks([emotionsVWC, numRowsVWC], (): Emotion[][] => {
    const emotions = emotionsVWC.get();
    const rows = numRowsVWC.get();

    if (emotions === null) {
      return [];
    }

    const numPerRow = Math.ceil(emotions.length / rows);
    if (numPerRow === 0) {
      return [];
    }

    const result: Emotion[][] = [];
    for (let i = 0; i < rows; i++) {
      result.push(emotions.slice(i * numPerRow, (i + 1) * numPerRow));
    }

    // iteratively fix jumps of 2 or more by moving emotions from earlier rows
    // to later rows; this has to end at some point because each step moves an
    // emotion from row i to i+1, and there are finitely many emotions. in
    // practice, it usually does at most 2 iterations
    while (true) {
      let foundImprovement = false;
      for (let i = 0; i < rows - 1; i++) {
        if (result[i].length - result[i + 1].length > 1) {
          const toMove = result[i].pop()!;
          result[i + 1].unshift(toMove);
          foundImprovement = true;
        }
      }
      if (!foundImprovement) {
        break;
      }
    }

    return result;
  });

  return (
    <div className={styles.container} ref={(r) => setVWC(containerRef, r)}>
      {question !== null && (
        <div className={styles.question} ref={(r) => setVWC(questionRef, r)}>
          {question}
        </div>
      )}
      <RenderGuardedComponent
        props={rowsVWC}
        component={(rows) => (
          <>
            {rows.map((row, i) => (
              <Fragment key={i}>
                {i !== 0 && <div style={{ height: `${rowGap}px` }} />}
                <EmotionRow
                  emotions={row}
                  onTapEmotion={onTapEmotion}
                  contentWidth={contentWidthVWC}
                />
              </Fragment>
            ))}
          </>
        )}
      />
    </div>
  );
};

const EmotionRow = ({
  emotions,
  onTapEmotion,
  contentWidth: contentWidthVWC,
}: {
  emotions: Emotion[];
  onTapEmotion: (emotion: Emotion) => void;
  contentWidth: ValueWithCallbacks<number>;
}): ReactElement => {
  const rowRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const rowStyleVWC = useMappedValueWithCallbacks(
    contentWidthVWC,
    (w): CSSProperties => ({
      maxWidth: `${w}px`,
    })
  );
  useStyleVWC(rowRef, rowStyleVWC);

  useValuesWithCallbacksEffect([rowRef], () => {
    const row = rowRef.get();
    if (row === null) {
      return undefined;
    }

    if (row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: (row.scrollWidth - row.clientWidth) / 2 });
    }
    return undefined;
  });

  return (
    <div className={styles.row} ref={(r) => setVWC(rowRef, r)} style={rowStyleVWC.get()}>
      {emotions.map((emotion, i) => (
        <Fragment key={i}>
          {i !== 0 && <div style={{ width: '16px', paddingLeft: '16px' }} />}
          <EmotionButton emotion={emotion} onTapEmotion={onTapEmotion} />
        </Fragment>
      ))}
    </div>
  );
};

const EmotionButton = ({
  emotion,
  onTapEmotion,
}: {
  emotion: Emotion;
  onTapEmotion: (emotion: Emotion) => void;
}): ReactElement => {
  return (
    <button
      className={styles.emotionButton}
      onClick={(e) => {
        e.preventDefault();
        onTapEmotion(emotion);
      }}>
      {emotion.word}
    </button>
  );
};
