import { Modals } from '../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { showUploadSelector } from '../../../shared/upload/selector/showUploadSelector';
import { CourseLogo, courseLogoKeyMap } from './CourseLogo';
import { CourseLogoList } from './CourseLogoList';

/**
 * Allows the user to peruse already uploaded course logos and returns
 * the one they choose.
 */
export const showCourseLogoSelector = (
  modals: WritableValueWithCallbacks<Modals>
): CancelablePromise<CourseLogo | undefined> => {
  return showUploadSelector({
    modals,
    content: {
      description: (
        <>
          <p>
            Choose from recently uploaded logos below. The content is shown from most recently
            uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as logos are
            automatically de-duplicated: re-uploading is extremely fast and has no negative impact.
          </p>
        </>
      ),
      path: '/api/1/courses/logos/search',
      keyMap: courseLogoKeyMap,
      itemsComponent: ({ items, onClick }) => <CourseLogoList items={items} onClick={onClick} />,
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'last_uploaded_at', dir: 'desc', before: null, after: null },
      ]),
    },
  });
};
