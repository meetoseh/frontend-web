import { LoginContextValue } from '../../../../shared/contexts/LoginContext';
import { Modals } from '../../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../../shared/upload/uploader/showUploader';
import { CourseVideoThumbnail, courseVideoThumbnailKeyMap } from './CourseVideoThumbnail';

const minWidth = 1920;
const minHeight = 1080;

/**
 * Shows a pop-up that allows the user to upload a new course video thumbnail.
 * If the course video thumbnail already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded course video thumbnail, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showCourseVideoThumbnailUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<CourseVideoThumbnail | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the image file you want to use as the video thumbnail for this course. This will
            detect if the image file has already been processed and, if so, select the existing
            processed image.
          </p>

          <p>
            Video thumbnails that are just frames from the video are extracted automatically; you
            can get the prompt to choose from those frames by selecting the video again.
          </p>

          <p>Our servers will handle cropping. The primary aspect ratios produced are:</p>

          <ol>
            <li>mobile portrait: about 9:16</li>
            <li>desktop: about 16:9</li>
          </ol>
          <p>
            The minimum resolution is {minWidth}x{minHeight}.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/courses/videos/thumbnails/',
        additionalBodyParameters: undefined,
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/courses/videos/thumbnails/search',
        courseVideoThumbnailKeyMap,
        loginContextRaw
      ),
    },
  });
};
