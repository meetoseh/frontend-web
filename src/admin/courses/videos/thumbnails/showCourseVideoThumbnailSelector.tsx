import { Modals } from '../../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { showUploadSelector } from '../../../../shared/upload/selector/showUploadSelector';
import { CourseVideoThumbnail, courseVideoThumbnailKeyMap } from './CourseVideoThumbnail';
import { CourseVideoThumbnailImageList } from './CourseVideoThumbnailList';

/**
 * Allows the user to peruse already uploaded course video thumbnails and returns
 * the one they choose.
 */
export const showCourseVideoThumbnailSelector = (
  modals: WritableValueWithCallbacks<Modals>,
  opts?: {
    /**
     * If specified, only auto-generated thumbnails for the given video will be shown.
     */
    sourceVideoSHA512?: string;
  }
): CancelablePromise<CourseVideoThumbnail | undefined> => {
  const sourceVideoSHA512 = opts?.sourceVideoSHA512 ?? null;
  return showUploadSelector({
    modals,
    content: {
      description:
        sourceVideoSHA512 === null ? (
          <>
            <p>
              Choose from recently uploaded or extracted thumbnails below. The content is shown from
              most recent to least recent.
            </p>
            <p>
              It is usually easier to use the upload option to select a local file, as images are
              automatically de-duplicated: re-uploading is extremely fast and has no negative
              impact.
            </p>
          </>
        ) : (
          <>
            <p>
              Choose from the extracted thumbnails below. The content is shown from earlier in the
              video to later.
            </p>
          </>
        ),
      path: '/api/1/courses/videos/thumbnails/search',
      keyMap: courseVideoThumbnailKeyMap,
      itemsComponent: ({ items, onClick }) => (
        <CourseVideoThumbnailImageList items={items} onClick={onClick} />
      ),
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'last_uploaded_at', dir: 'desc', before: null, after: null },
      ]),
      filters:
        sourceVideoSHA512 === null
          ? undefined
          : createWritableValueWithCallbacks({
              source_video_sha512: {
                operator: 'eq',
                value: sourceVideoSHA512,
              },
            }),
    },
  });
};
