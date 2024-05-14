import { ReactElement } from 'react';
import { SimpleImageFilesChoice } from '../../../shared/upload/selector/SimpleImageFilesChoice';
import { ClientFlowImage } from './ClientFlowImage';

/**
 * Presents a list of client flow images, allowing the user to
 * select one.
 */
export const ClientFlowImageList = ({
  items,
  onClick,
  preview,
}: {
  items: ClientFlowImage[];
  onClick: (item: ClientFlowImage) => void;
  /**
   * The size to render the items at. Usually, this comes from
   * the x-preview hint on the `{"type": "image_uid"}` openapi
   * 3.0.3 schema that the image is targeting.
   */
  preview: { width: number; height: number };
}): ReactElement => (
  <SimpleImageFilesChoice
    items={items}
    itemToImage={(item) => item.imageFile}
    displaySize={{ displayWidth: preview.width, displayHeight: preview.height }}
    onClick={onClick}
  />
);
