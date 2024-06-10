import { useCallback, useEffect, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { OsehTranscript, OsehTranscriptPhrase } from './OsehTranscript';
import { setVWC } from '../lib/setVWC';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';

export type UseCurrentTranscriptPhrasesProps = {
  /**
   * The transcript, null if loading and undefined if unavailable
   */
  transcript?: ValueWithCallbacks<OsehTranscript | null | undefined>;
};

export type UseCurrentTranscriptPhrasesUnavailable = {
  /** unavailable indicates that the transcript ref provided was null */
  type: 'unavailable';
  phrases: never[];
  error: null;
  currentTime: WritableValueWithCallbacks<number>;
};

export type UseCurrentTranscriptPhrasesLoading = {
  type: 'loading';
  phrases: never[];
  error: null;
  currentTime: WritableValueWithCallbacks<number>;
};

export type UseCurrentTranscriptPhrasesLoaded = {
  type: 'loaded';
  /**
   * The phrases at the current time
   */
  phrases: { phrase: OsehTranscriptPhrase; id: number }[];
  error: null;
  currentTime: WritableValueWithCallbacks<number>;
};

export type UseCurrentTranscriptPhrasesResult =
  | UseCurrentTranscriptPhrasesUnavailable
  | UseCurrentTranscriptPhrasesLoading
  | UseCurrentTranscriptPhrasesLoaded;

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
  transcript: transcriptRawVWC,
}: UseCurrentTranscriptPhrasesProps): ValueWithCallbacks<UseCurrentTranscriptPhrasesResult> => {
  const currentTimeVWC = useWritableValueWithCallbacks(() => 0);

  const transcriptVWC = useWritableValueWithCallbacks<OsehTranscript | null | undefined>(
    () => transcriptRawVWC?.get() ?? null
  );
  useEffect(() => {
    if (transcriptRawVWC === undefined) {
      setVWC(transcriptVWC, undefined);
      return undefined;
    }

    return createValueWithCallbacksEffect(transcriptRawVWC, (v) => {
      setVWC(transcriptVWC, v);
      return undefined;
    });
  }, [transcriptRawVWC, transcriptVWC]);

  const adjustedTranscriptVWC = useMappedValueWithCallbacks(
    transcriptVWC,
    (transcript): OsehTranscript | null | undefined => {
      if (transcript === null || transcript === undefined || transcript.phrases.length < 1) {
        return transcript;
      }

      const phrases = transcript.phrases;
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
        ...transcript,
        phrases: adjustedPhrases,
      };
    }
  );

  const transcriptSearchIndexHint = useRef<{ progressSeconds: number; index: number }>({
    progressSeconds: 0,
    index: 0,
  });

  const phrasesVWC = useMappedValuesWithCallbacks(
    [adjustedTranscriptVWC, currentTimeVWC],
    (): { phrase: OsehTranscriptPhrase; id: number }[] => {
      const transcriptRaw = adjustedTranscriptVWC.get();
      if (transcriptRaw === null || transcriptRaw === undefined) {
        return [];
      }

      const phrases = transcriptRaw.phrases;
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
    [transcriptVWC, phrasesVWC],
    useCallback(() => {
      const transcript = transcriptVWC.get();
      if (transcript === undefined) {
        return { type: 'unavailable', phrases: [], error: null, currentTime: currentTimeVWC };
      }

      if (transcript === null) {
        return { type: 'loading', phrases: [], error: null, currentTime: currentTimeVWC };
      }

      const phrases = phrasesVWC.get();
      return {
        type: 'loaded',
        phrases,
        error: null,
        currentTime: currentTimeVWC,
      };
    }, [phrasesVWC, currentTimeVWC, transcriptVWC])
  );
};
