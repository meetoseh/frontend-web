import { Modals } from '../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { showUploadSelector } from '../../../shared/upload/selector/showUploadSelector';
import { OnboardingVideoList } from './OnboardingVideoList';
import { OnboardingVideoUpload, onboardingVideoUploadKeyMap } from './OnboardingVideoUpload';

/**
 * Allows the user to peruse already uploaded course videos and returns
 * the one they choose.
 */
export const showOnboardingVideoSelector = (
  modals: WritableValueWithCallbacks<Modals>
): CancelablePromise<OnboardingVideoUpload | undefined> => {
  return showUploadSelector({
    modals,
    content: {
      description: (
        <>
          <p>
            Choose from recently uploaded videos below. The content is shown from most recently
            uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as videos are
            automatically de-duplicated: re-uploading is extremely fast and has no negative impact.
          </p>
        </>
      ),
      path: '/api/1/onboarding/videos/uploads/search',
      keyMap: onboardingVideoUploadKeyMap,
      itemsComponent: ({ items, onClick }) => (
        <OnboardingVideoList items={items} onClick={onClick} />
      ),
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'last_uploaded_at', dir: 'desc', before: null, after: null },
      ]),
    },
  });
};
