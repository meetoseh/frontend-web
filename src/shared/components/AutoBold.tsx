import { Fragment, ReactElement, useMemo } from 'react';

export const MARKDOWN_STRONG_DELIMINATORS = ['**', '__'];

/**
 * Puts the given message in a div with the given class name, bolding
 * text surrounded with the deliminator with `strong` (or `bolder` if
 * specified)
 */
export const AutoBold = ({
  message,
  className,
  deliminators: deliminatorsRaw,
  bolder,
}: {
  message: string;
  className: string;
  /** By default, the markdown deliminators */
  deliminators?: string[];
  bolder?: (text: string, deliminator: string, idx: number) => ReactElement;
}): ReactElement => {
  const deliminators = deliminatorsRaw ?? MARKDOWN_STRONG_DELIMINATORS;
  const parts = useMemo((): ReactElement[] => {
    const result: ReactElement[] = [];
    extractParts(message, deliminators, (text, deliminator, idx) => {
      if (deliminator) {
        const bolderElement = bolder ? (
          bolder(text, deliminator, idx)
        ) : (
          <strong key={idx}>{text}</strong>
        );
        result.push(bolderElement);
      } else {
        result.push(<Fragment key={idx}>{text}</Fragment>);
      }
    });
    return result;
  }, [message, deliminators, bolder]);

  return <div className={className}>{parts}</div>;
};

/**
 * Extracts parts of a message based on the given deliminators. For example,
 * ```md
 * this _is_ **some** __text__
 * ```
 *
 * becomes
 *
 * ```
 * [
 *   { text: 'this ', deliminator: null },
 *   { text: 'is', deliminator: '_' },
 *   { text: ' ', deliminator: null },
 *   { text: 'some', deliminator: '**' },
 *   { text: ' ', deliminator: null },
 *   { text: 'text', deliminator: '__' }
 * ]
 * ```
 *
 * assuming deliminators is `['__', '**', '_']`. Deliminators must be
 * specified from most specific to least specific.
 *
 * The parts are returned as function calls to onNext, where calling `finish`
 * will stop the iteration. Nested deliminators are not supported.
 */
export const extractParts = (
  message: string,
  deliminators: string[],
  onNext: (text: string, deliminator: string | null, idx: number, finish: () => void) => void
) => {
  let ctr = 0;

  let handledUpTo = 0;
  let idx = 0;

  let finished = false;
  const finish = () => {
    finished = true;
  };

  while (idx < message.length) {
    // eslint-disable-next-line no-loop-func
    const matchingIndex = deliminators.findIndex((d) => message.startsWith(d, idx));
    if (matchingIndex < 0) {
      idx++;
      continue;
    }

    const delim = deliminators[matchingIndex];
    const insideStartsAt = idx + delim.length;
    const closeStartsAt = message.indexOf(delim, insideStartsAt);
    if (closeStartsAt < 0) {
      break;
    }

    if (handledUpTo < idx) {
      onNext(message.slice(handledUpTo, idx), null, ctr, finish);
      ctr++;
      if (finished) {
        return;
      }
    }

    onNext(message.slice(insideStartsAt, closeStartsAt), delim, ctr, finish);
    ctr++;
    if (finished) {
      return;
    }

    handledUpTo = closeStartsAt + delim.length;
    idx = handledUpTo;
  }

  if (handledUpTo < message.length) {
    onNext(message.slice(handledUpTo), null, ctr, finish);
  }
};
