import { ReactElement, useContext } from 'react';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { HomeScreenImage, homeScreenImageKeyMap } from './HomeScreenImage';
import { ModalContext, Modals } from '../../shared/contexts/ModalContext';
import { LoginContext, LoginContextValue } from '../../shared/contexts/LoginContext';
import { WritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { CancelablePromise } from '../../shared/lib/CancelablePromise';
import { showUploader } from '../../shared/upload/uploader/showUploader';
import { createUploadPoller } from '../../shared/upload/uploader/createUploadPoller';
import { Button } from '../../shared/forms/Button';
import styles from './CreateHomeScreenImage.module.css';

type CreateHomeScreenImageProps = {
  /**
   * Called after a home screen image is created by the user
   * @param homeScreenImage The home screen image that was created
   */
  onCreated: (this: void, homeScreenImage: HomeScreenImage) => void;
};

const minWidth = 1920;
const minHeight = 1366;

/**
 * Shows a pop-up that allows the user to upload a new home screen image.
 * If the home screen image already exists, the file is not uploaded and
 * instead the existing already processed image is returned.
 *
 * @param modals The modals context to use to show the pop-up.
 * @returns A promise that resolves to the uploaded home screen image, or
 *   undefined if the user closes the modal before the upload is complete. Can be
 *   cancelled to close the modal early.
 */
const showHomeScreenImageUploader = (
  modals: WritableValueWithCallbacks<Modals>,
  loginContextRaw: LoginContextValue
): CancelablePromise<HomeScreenImage | undefined> => {
  return showUploader({
    modals,
    content: {
      description: (
        <>
          <p>
            Select the image file you want to use as the home screen image. This will detect if the
            image file has already been processed and, if so, add the existing processed image above
            if it's not already there. Note there is a filter option for "Original File" in the
            Filter and Sort options that can be used to check if the file exists.
          </p>

          <p>
            Our servers will handle cropping and darkening. The primary aspect ratios produced are:
          </p>

          <ol>
            <li>mobile: 1x, 2x, and 3x versions of 390 x 350</li>
            <li>desktop: 1x and 2x versions of 1920x350 (2x optional)</li>
          </ol>
          <p>
            The minimum resolution is {minWidth}x{minHeight}.
          </p>
          <p>
            The home screen image will be initially configured not to show to anyone. You will need
            to patch it with the desired settings and enable it for users without pro, users with
            pro, or both.
          </p>
        </>
      ),
      startEndpoint: {
        type: 'path',
        path: '/api/1/personalization/home/images/',
        additionalBodyParameters: undefined,
      },
      accept: 'image/*',
      poller: createUploadPoller(
        '/api/1/personalization/home/images/search',
        homeScreenImageKeyMap,
        loginContextRaw,
        {
          sha512Key: 'image_file_original_sha512',
        }
      ),
    },
  });
};

/**
 * Renders a block which allows the user to pick an image and watch
 * the progress as it's uploaded
 */
export const CreateHomeScreenImage = ({ onCreated }: CreateHomeScreenImageProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);

  return (
    <CrudCreateBlock>
      <div className={styles.uploadContainer}>
        <Button
          type="button"
          variant="filled"
          onClick={async (e) => {
            e.preventDefault();
            const result = await showHomeScreenImageUploader(modalContext.modals, loginContextRaw)
              .promise;
            if (result) {
              onCreated(result);
            }
          }}>
          Upload
        </Button>
      </div>
    </CrudCreateBlock>
  );
};
