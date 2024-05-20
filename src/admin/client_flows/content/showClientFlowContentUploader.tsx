import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { ClientFlowContent, clientFlowContentKeyMap } from './ClientFlowContent';

/**
 * Shows a pop-up that allows the user to upload new client flow content. If the
 * client flow content already exists, the file is not uploaded and instead the
 * existing already processed video/audio file is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded client flow content, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showClientFlowContentUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue,
  opts: {
    /** Usually from the x-processor hint */
    processor: { job: string; list: string };
    /** The openapi 3.0.3 schema description for the variable */
    description: string;
  }
): CancelablePromise<ClientFlowContent | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the content file you want to use. This will detect if the content file has
            already been processed and, if so, select the existing processed content.
          </p>

          <p>
            The preprocessor used will be <code>{opts.processor.job}</code>, which will target the
            list <code>{opts.processor.list}</code>.
          </p>

          <p>{opts.description}</p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/admin/client_flows/content/',
        additionalBodyParameters: {
          job: opts.processor.job,
        },
      },
      accept: 'video/*, audio/*',
      poller: createUploadPoller(
        '/api/1/admin/client_flows/content/search',
        clientFlowContentKeyMap,
        loginContextRaw,
        {
          additionalFilters: {
            list_slug: {
              operator: 'eq',
              value: opts.processor.list,
            },
          },
        }
      ),
    },
  });
};
