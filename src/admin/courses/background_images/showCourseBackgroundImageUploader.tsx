import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { CourseBackgroundImage, courseBackgroundImageKeyMap } from './CourseBackgroundImage';

const minWidth = 1026;
const minHeight = 1281;

/**
 * Shows a pop-up that allows the user to upload a new course background image.
 * If the course background image already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded course background image, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showCourseBackgroundImageUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<CourseBackgroundImage | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the image file you want to use as the background for this course. This will
            detect if the image file has already been processed and, if so, select the existing
            processed image.
          </p>

          <p>
            Our servers will handle cropping and darkening. The primary aspect ratios produced are:
          </p>

          <ol>
            <li>mobile: 1x, 2x, and 3x versions of 342 x 427</li>
            <li>desktop: 1x and 2x versions of 382 x 539</li>
          </ol>
          <p>
            The minimum resolution is {minWidth}x{minHeight}.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/courses/background_images/',
        additionalBodyParameters: undefined,
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/courses/background_images/search',
        courseBackgroundImageKeyMap,
        loginContextRaw
      ),
    },
  });
};
