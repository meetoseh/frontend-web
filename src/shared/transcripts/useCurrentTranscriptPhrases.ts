import { ReactElement, useCallback, useRef } from 'react';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { OsehTranscriptRef } from './OsehTranscriptRef';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useOsehTranscriptValueWithCallbacks } from './useOsehTranscriptValueWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { OsehTranscriptPhrase } from './OsehTranscript';

export type UseCurrentTranscriptPhrasesProps = {
  transcriptRef: ValueWithCallbacks<OsehTranscriptRef | null>;
  currentTime: ValueWithCallbacks<number>;
};

export type UseCurrentTranscriptPhrasesResult = {
  /**
   * True if we are currently fetching the transcript, false otherwise
   */
  loading: boolean;
  /**
   * The phrases at the current time
   */
  phrases: { phrase: OsehTranscriptPhrase; id: number }[];
  /**
   * The error that is preventing us from loading further phrases,
   * if any
   */
  error: ReactElement | null;
};

export const fadeTimeSeconds = 0.5;
export const showEarlySeconds = fadeTimeSeconds;
export const holdLateSeconds = 3 + fadeTimeSeconds;
/**
 * In order to prevent cc from shifting, we will move the end of a phrase
 * up to this much earlier to prevent it from overlapping with the start
 * of the next phrase
 */
const maximumAdjustmentToAvoidMultipleOnScreen = holdLateSeconds + 1;

/**
 * Loads the transcript phrases matching the current time, if a transcript
 * is available and has been loaded, otherwise returns an empty list of
 * phrases.
 */
export const useCurrentTranscriptPhrases = ({
  transcriptRef: transcriptRefVWC,
  currentTime: currentTimeVWC,
}: UseCurrentTranscriptPhrasesProps): ValueWithCallbacks<UseCurrentTranscriptPhrasesResult> => {
  const transcriptVWC = useOsehTranscriptValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(transcriptRefVWC)
  );
  const loading = useMappedValueWithCallbacks(transcriptVWC, (t) => t.type === 'loading');
  const error = useMappedValueWithCallbacks(transcriptVWC, (t) =>
    t.type === 'error' ? t.error : null
  );

  const adjustedTranscriptVWC = useMappedValueWithCallbacks(transcriptVWC, (t) => {
    if (t.type !== 'success' || t.transcript.phrases.length < 1) {
      return t;
    }

    const phrases = t.transcript.phrases;
    const adjustedPhrases = [];

    for (let i = 0; i < phrases.length - 1; i++) {
      const domEndOfThisPhrase = phrases[i].endsAt + holdLateSeconds;
      const domStartOfNextPhrase = phrases[i + 1].startsAt - showEarlySeconds;
      let adjustedEndsAt = phrases[i].endsAt;
      if (
        domEndOfThisPhrase > domStartOfNextPhrase &&
        domEndOfThisPhrase - domStartOfNextPhrase < maximumAdjustmentToAvoidMultipleOnScreen
      ) {
        adjustedEndsAt -= domEndOfThisPhrase - domStartOfNextPhrase;
        if (adjustedEndsAt < phrases[i].startsAt) {
          adjustedEndsAt = phrases[i].startsAt;
        }
      }
      adjustedPhrases.push({ ...phrases[i], endsAt: adjustedEndsAt });
    }
    adjustedPhrases.push(phrases[phrases.length - 1]);

    return {
      ...t,
      transcript: {
        ...t.transcript,
        phrases: adjustedPhrases,
      },
    };
  });

  const transcriptSearchIndexHint = useRef<{ progressSeconds: number; index: number }>({
    progressSeconds: 0,
    index: 0,
  });

  const phrasesVWC = useMappedValuesWithCallbacks(
    [adjustedTranscriptVWC, currentTimeVWC],
    (): { phrase: OsehTranscriptPhrase; id: number }[] => {
      const transcriptRaw = adjustedTranscriptVWC.get();
      if (transcriptRaw.type !== 'success') {
        return [];
      }

      const phrases = transcriptRaw.transcript.phrases;
      const progressSeconds = currentTimeVWC.get();
      const hint = transcriptSearchIndexHint.current;

      if (hint.progressSeconds > progressSeconds) {
        hint.progressSeconds = 0;
        hint.index = 0;
      }

      if (hint.index >= phrases.length) {
        return [];
      }

      while (
        hint.index < phrases.length &&
        phrases[hint.index].startsAt - showEarlySeconds < progressSeconds &&
        phrases[hint.index].endsAt + holdLateSeconds < progressSeconds
      ) {
        hint.index++;
      }
      hint.progressSeconds =
        hint.index < phrases.length
          ? phrases[hint.index].startsAt - showEarlySeconds
          : phrases[hint.index - 1].endsAt + holdLateSeconds;
      if (hint.index >= phrases.length) {
        return [];
      }

      const result: { phrase: OsehTranscriptPhrase; id: number }[] = [];
      let index = hint.index;
      while (
        index < phrases.length &&
        phrases[index].startsAt - showEarlySeconds < progressSeconds &&
        phrases[index].endsAt + holdLateSeconds > progressSeconds
      ) {
        result.push({ phrase: phrases[index], id: index });
        index++;
      }
      return result;
    }
  );

  return useMappedValuesWithCallbacks(
    [loading, phrasesVWC, error],
    useCallback(
      () => ({
        loading: loading.get(),
        phrases: phrasesVWC.get(),
        error: error.get(),
      }),
      [loading, phrasesVWC, error]
    )
  );
};
