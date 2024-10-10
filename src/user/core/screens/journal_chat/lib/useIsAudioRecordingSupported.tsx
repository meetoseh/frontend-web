import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';

type UseIsAudioRecordingSupportedResult = {
  /** pending if the value might change, final if the value is final */
  type: 'pending' | 'final';
  /** true if google auth is supported, false otherwise */
  value: boolean;
};

/**
 * Attempts to determine if audio recording support is available. Where possible
 * this uses feature detection. If we find some browsers that make feature detection
 * difficult/impossible, we will try other methods.
 */
export const useIsAudioRecordingSupported =
  (): ValueWithCallbacks<UseIsAudioRecordingSupportedResult> => {
    return useWritableValueWithCallbacks(
      (): UseIsAudioRecordingSupportedResult => ({
        type: 'final',
        value: !!(
          window &&
          window.navigator &&
          window.navigator.mediaDevices &&
          window.navigator.mediaDevices.getUserMedia
        ),
      })
    );
  };
