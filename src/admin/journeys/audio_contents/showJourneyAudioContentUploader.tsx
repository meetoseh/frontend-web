import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { JourneyAudioContent } from './JourneyAudioContent';
import { keyMap } from './JourneyAudioContents';

/**
 * Shows a pop-up that allows the user to upload a new journey audio content.
 * If the journey audio content already exists, the file is not uploaded and
 * instead the existing already processed audio is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded journey audio content, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showJourneyAudioContentUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<JourneyAudioContent | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the audio file you want to use as the content for this journey. This will detect
            if the audio file has already been processed and, if so, select the existing processed
            audio.
          </p>

          <p>
            Our servers will compress the file into several formats, which will ensure every device
            gets the best possible experience. This works best if the uploaded audio files are
            uploaded with 2 channels at 44.1 kHz, with 24-bit depth and a bitrate of 2116.8 kbps. At
            these settings, the file size should be around 265 Kb/second, or just under 16 Mb for a
            60 second file.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/journeys/audio_contents/',
        additionalBodyParameters: undefined,
      },
      accept: 'audio/wav',
      poller: createUploadPoller('/api/1/journeys/audio_contents/search', keyMap, loginContextRaw),
    },
  });
};
