import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { JourneyBackgroundImage } from './JourneyBackgroundImage';
import { keyMap } from './JourneyBackgroundImages';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';

const minWidth = 2560;
const minHeight = 2745;

/**
 * Shows a pop-up that allows the user to upload a new journey background image.
 * If the journey background image already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded journey background image, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showJourneyBackgroundImageUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<JourneyBackgroundImage | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the image file you want to use as the background for this journey. This will
            detect if the image file has already been processed and, if so, select the existing
            processed image.
          </p>

          <p>
            Our servers will handle cropping, darkening, and blurring the image. The aspect ratios
            produced are:
          </p>

          <ol>
            <li>
              mobile: around <strong>2:1</strong>
            </li>
            <li>
              share to instagram: <strong>9:16</strong>
            </li>
            <li>
              desktop: around <strong>16:9</strong>
            </li>
          </ol>
          <p>
            The minimum resolution is {minWidth}x{minHeight}, to accomodate 2560x1600 desktop (mac
            13.3in) and 1242x2745 3x mobile portrait mode. The highest quality available image
            should be uploaded to minimize compression artifacts.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/journeys/background_images/',
        additionalBodyParameters: undefined,
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/journeys/background_images/search',
        keyMap,
        loginContextRaw
      ),
    },
  });
};
