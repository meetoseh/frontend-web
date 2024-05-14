import { Modals } from '../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { showUploadSelector } from '../../../shared/upload/selector/showUploadSelector';
import { ClientFlowImage, clientFlowImageKeyMap } from './ClientFlowImage';
import { ClientFlowImageList } from './ClientFlowImageList';

/**
 * Allows the user to peruse already uploaded client flow images and returns
 * the one they choose.
 */
export const showClientFlowImageSelector = (
  modals: WritableValueWithCallbacks<Modals>,
  /** Usually from the x-processor hint */
  listSlug: string,
  /** Usually from the x-preview hint */
  preview: { width: number; height: number }
): CancelablePromise<ClientFlowImage | undefined> => {
  return showUploadSelector({
    modals,
    content: {
      description: (
        <>
          <p>
            Choose from recently uploaded {listSlug} client flow images below. The content is shown
            from most recently uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as these images
            are automatically de-duplicated: re-uploading is extremely fast and has no negative
            impact.
          </p>
        </>
      ),
      path: '/api/1/admin/client_flows/image/search',
      keyMap: clientFlowImageKeyMap,
      itemsComponent: ({ items, onClick }) => (
        <ClientFlowImageList items={items} onClick={onClick} preview={preview} />
      ),
      fetchLimit: 6,
      loadMoreReplaces: true,
      sort: createWritableValueWithCallbacks([
        { key: 'last_uploaded_at', dir: 'desc', before: null, after: null },
      ]),
      filters: createWritableValueWithCallbacks({
        list_slug: {
          operator: 'eq',
          value: listSlug,
        },
      }),
    },
  });
};
