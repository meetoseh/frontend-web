import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { CourseHeroImage, courseHeroImageKeyMap } from './CourseHeroImage';

const minWidth = 2560;
const minHeight = 1920;

/**
 * Shows a pop-up that allows the user to upload a new course hero image.
 * If the course hero image already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded course hero image, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showCourseHeroImageUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<CourseHeroImage | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the image file you want to use as the hero for this course. This will detect if
            the image file has already been processed and, if so, select the existing processed
            image.
          </p>

          <p>Our servers will handle cropping. The primary aspect ratios produced are:</p>

          <ol>
            <li>mobile: 1:1 at full screen width</li>
            <li>desktop: about 4:3 at 2/3 screen width</li>
          </ol>
          <p>
            The minimum resolution is {minWidth}x{minHeight}.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/courses/hero_images/',
        additionalBodyParameters: undefined,
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/courses/hero_images/search',
        courseHeroImageKeyMap,
        loginContextRaw
      ),
    },
  });
};
