import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { ClientFlowImage, clientFlowImageKeyMap } from './ClientFlowImage';

/**
 * Shows a pop-up that allows the user to upload a new client flow image. If the
 * client flow image already exists, the file is not uploaded and instead the
 * existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded client flow image, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showClientFlowImageUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue,
  opts: {
    /** Usually from the x-processor hint */
    processor: { job: string; list: string };
    /** The resolved dynamic size from the x-dynamic-size hint, or null if dynamic sizing is not supported */
    dynamicSize: { width: number; height: number } | null;
    /** The openapi 3.0.3 schema description for the variable */
    description: string;
  }
): CancelablePromise<ClientFlowImage | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the image file you want to use. This will detect if the image file has already
            been processed and, if so, select the existing processed image.
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
        path: '/api/1/admin/client_flows/image/',
        additionalBodyParameters: {
          job: opts.processor.job,
          ...(opts.dynamicSize === null ? {} : { dynamic_size: opts.dynamicSize }),
        },
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/admin/client_flows/image/search',
        clientFlowImageKeyMap,
        loginContextRaw,
        {
          additionalFilters: {
            list_slug: {
              operator: 'eq',
              value:
                opts.processor.list +
                (opts.dynamicSize === null
                  ? ''
                  : `@${opts.dynamicSize.width}x${opts.dynamicSize.height}`),
            },
          },
        }
      ),
    },
  });
};
