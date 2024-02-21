import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { CourseLogo, courseLogoKeyMap } from './CourseLogo';

/**
 * Shows a pop-up that allows the user to upload a new course logo.
 * If the course logo already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded course logo, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showCourseLogoUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<CourseLogo | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the SVG you want to use as the logo for this course. This will detect if the SVG
            has already been processed and, if so, select the existing processed image.
          </p>
          <p>
            Our servers will handle rasterization. The SVGs natural aspect ratio, as determined by
            the viewBox attribute, will be preserved.
          </p>
          <p>
            We may show the logo on a dark background with padding in the admin preview so it's
            legible, however, the logo itself should have a transparent background and be clipped
            fairly tight.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/courses/logos/',
        additionalBodyParameters: undefined,
      },
      accept: 'image/svg+xml',
      poller: createUploadPoller('/api/1/courses/logos/search', courseLogoKeyMap, loginContextRaw),
    },
  });
};
