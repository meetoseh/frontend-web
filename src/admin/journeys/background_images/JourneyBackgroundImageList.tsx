import { ReactElement } from 'react';
import { JourneyBackgroundImage } from './JourneyBackgroundImage';
import { SimpleImageFilesChoice } from '../../../shared/upload/selector/SimpleImageFilesChoice';

/**
 * Presents a list of journey background images, allowing the user to
 * select one.
 */
export const JourneyBackgroundImageList = ({
  items,
  onClick,
}: {
  items: JourneyBackgroundImage[];
  onClick: (item: JourneyBackgroundImage) => void;
}): ReactElement => (
  <SimpleImageFilesChoice
    items={items}
    itemToImage={(item) => item.imageFile}
    displaySize={{ displayWidth: 180, displayHeight: 368 }}
    onClick={onClick}
  />
);
