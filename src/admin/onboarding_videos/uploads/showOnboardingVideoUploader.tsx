import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { OnboardingVideoUpload, onboardingVideoUploadKeyMap } from './OnboardingVideoUpload';

const minWidth = 1920;
const minHeight = 1080;

/**
 * Shows a pop-up that allows the user to upload a new onboarding video.
 * If the onboarding video already exists, the file is not uploaded and
 * instead the existing entry is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded onboarding video, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showOnboardingVideoUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<OnboardingVideoUpload | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the video file you want to use as the onboarding video. This will detect if the
            video file has already been processed and, if so, select the existing video.
          </p>

          <p>
            Our servers will handle cropping, and they will extract a few frames as potential
            "thumbnails" (what to show before the video is ready to play)
          </p>

          <p>
            The minimum resolution is {minWidth}x{minHeight}.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/onboarding/videos/uploads/',
        additionalBodyParameters: undefined,
      },
      accept: 'video/*',
      poller: createUploadPoller(
        '/api/1/onboarding/videos/uploads/search',
        onboardingVideoUploadKeyMap,
        loginContextRaw
      ),
    },
  });
};
