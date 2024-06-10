import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehTranscript } from '../../../../shared/transcripts/OsehTranscript';
import { OsehTranscriptRef } from '../../../../shared/transcripts/OsehTranscriptRef';
import { ScreenResources } from '../../models/Screen';

export type VideoInterstitialResources = ScreenResources & {
  /**
   * The video to use
   */
  video: ValueWithCallbacks<OsehMediaContentState<HTMLVideoElement>>;

  /**
   * The transcript for the video, if available
   */
  transcript: ValueWithCallbacks<OsehTranscript | null | undefined>;
};
