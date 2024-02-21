import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { CourseVideo, courseVideoKeyMap } from './CourseVideo';

const minWidth = 1920;
const minHeight = 1080;

/**
 * Shows a pop-up that allows the user to upload a new course video.
 * If the course video already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded course video, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showCourseVideoUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<CourseVideo | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the video you want to use as the intro for this course. This will detect if the
            video has already been processed and, if so, select the existing processed video.
          </p>

          <p>
            Our servers will handle cropping and compressing, and they will extract a few frames as
            potential "thumbnails" (what to show before the video is ready to play). The video will
            be exported in mobile portrait (exact aspect ratio varies) and desktop landscape (16:9)
          </p>

          <p>
            The minimum resolution, WxH, is {minWidth}x{minHeight}, to produce the best exports we
            currently serve is 2732x2732, and the ideal resolution that could produce native
            resolution for all modern phones is 2796x2796.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/courses/videos/',
        additionalBodyParameters: undefined,
      },
      accept: 'video/*',
      poller: createUploadPoller(
        '/api/1/courses/videos/search',
        courseVideoKeyMap,
        loginContextRaw
      ),
    },
  });
};
