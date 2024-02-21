import { Modals } from '../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { showUploadSelector } from '../../../shared/upload/selector/showUploadSelector';
import { CourseBackgroundImage, courseBackgroundImageKeyMap } from './CourseBackgroundImage';
import { CourseBackgroundImageList } from './CourseBackgroundImageList';

/**
 * Allows the user to peruse already uploaded course background images and returns
 * the one they choose.
 */
export const showCourseBackgroundImageSelector = (
  modals: WritableValueWithCallbacks<Modals>
): CancelablePromise<CourseBackgroundImage | undefined> => {
  return showUploadSelector({
    modals,
    content: {
      description: (
        <>
          <p>
            Choose from recently uploaded background images below. The content is shown from most
            recently uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as background
            images are automatically de-duplicated: re-uploading is extremely fast and has no
            negative impact.
          </p>
        </>
      ),
      path: '/api/1/courses/background_images/search',
      keyMap: courseBackgroundImageKeyMap,
      itemsComponent: ({ items, onClick }) => (
        <CourseBackgroundImageList items={items} onClick={onClick} />
      ),
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'last_uploaded_at', dir: 'desc', before: null, after: null },
      ]),
    },
  });
};
