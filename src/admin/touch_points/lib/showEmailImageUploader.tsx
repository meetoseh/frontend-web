import { Modals } from '../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createUploadPoller } from '../../../shared/upload/uploader/createUploadPoller';
import { showUploader } from '../../../shared/upload/uploader/showUploader';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { EmailImage, emailImageKeyMap } from '../models/EmailImage';

/**
 * Shows a pop-up that allows the user to upload a new email image. If the
 * email image already exists, the file is not uploaded and instead the
 * existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded client flow image, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
export const showEmailImageUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue,
  opts: {
    /** The size that will be used in the template, usually via the x-size hint */
    size: { width: number; height: number };
    /** The openapi 3.0.3 schema description for the variable */
    description: string;
  }
): CancelablePromise<EmailImage | undefined> => {
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
            The image will be rendered at a fixed size of {opts.size.width}px width by{' '}
            {opts.size.height}px height in the email template. That means you should upload an image
            that is {opts.size.width * 3}px width by {opts.size.height * 3}px height
          </p>

          <p>{opts.description}</p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/admin/email/image/',
        additionalBodyParameters: {
          size: opts.size,
        },
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/admin/email/image/search',
        emailImageKeyMap,
        loginContextRaw,
        {
          additionalFilters: {
            width: {
              operator: 'eq',
              value: opts.size.width,
            },
            height: {
              operator: 'eq',
              value: opts.size.height,
            },
          },
        }
      ),
    },
  });
};
