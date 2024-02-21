import { Modals } from '../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { showUploadSelector } from '../../../shared/upload/selector/showUploadSelector';
import { CourseHeroImage, courseHeroImageKeyMap } from './CourseHeroImage';
import { CourseHeroImageList } from './CourseHeroImageList';

/**
 * Allows the user to peruse already uploaded course hero images and returns
 * the one they choose.
 */
export const showCourseHeroImageSelector = (
  modals: WritableValueWithCallbacks<Modals>
): CancelablePromise<CourseHeroImage | undefined> => {
  return showUploadSelector({
    modals,
    content: {
      description: (
        <>
          <p>
            Choose from recently uploaded hero images below. The content is shown from most recently
            uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as images are
            automatically de-duplicated: re-uploading is extremely fast and has no negative impact.
          </p>
        </>
      ),
      path: '/api/1/courses/hero_images/search',
      keyMap: courseHeroImageKeyMap,
      itemsComponent: ({ items, onClick }) => (
        <CourseHeroImageList items={items} onClick={onClick} />
      ),
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'last_uploaded_at', dir: 'desc', before: null, after: null },
      ]),
    },
  });
};
