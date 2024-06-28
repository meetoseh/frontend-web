import { Modals } from '../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { SimpleImageFilesChoice } from '../../../shared/upload/selector/SimpleImageFilesChoice';
import { showUploadSelector } from '../../../shared/upload/selector/showUploadSelector';
import { EmailImage, emailImageKeyMap } from '../models/EmailImage';

/**
 * Allows the user to peruse already uploaded email images at a specific size
 * and returns the one they choose.
 */
export const showEmailImageSelector = (
  modals: WritableValueWithCallbacks<Modals>,
  /** Usually from the x-size hint */
  size: { width: number; height: number }
): CancelablePromise<EmailImage | undefined> => {
  return showUploadSelector({
    modals,
    content: {
      description: (
        <>
          <p>
            Choose from recently uploaded {size.width}px width by {size.height}px height images
            below. The content is shown from most recently uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as these images
            are automatically de-duplicated: re-uploading is extremely fast and has no negative
            impact.
          </p>
        </>
      ),
      path: '/api/1/admin/email/image/search',
      keyMap: emailImageKeyMap,
      itemsComponent: ({ items, onClick }) => (
        <SimpleImageFilesChoice
          items={items}
          itemToImage={(item) => item.imageFile}
          displaySize={{ displayWidth: size.width, displayHeight: size.height }}
          onClick={onClick}
        />
      ),
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'created_at', dir: 'desc', before: null, after: null },
      ]),
      filters: createWritableValueWithCallbacks({
        width: {
          operator: 'eq',
          value: size.width,
        },
        height: {
          operator: 'eq',
          value: size.height,
        },
      }),
    },
  });
};
