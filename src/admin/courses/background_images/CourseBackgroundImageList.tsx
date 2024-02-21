import { ReactElement } from 'react';
import { SimpleImageFilesChoice } from '../../../shared/upload/selector/SimpleImageFilesChoice';
import { CourseBackgroundImage } from './CourseBackgroundImage';

/**
 * Presents a list of course background images, allowing the user to
 * select one.
 */
export const CourseBackgroundImageList = ({
  items,
  onClick,
}: {
  items: CourseBackgroundImage[];
  onClick: (item: CourseBackgroundImage) => void;
}): ReactElement => (
  <SimpleImageFilesChoice
    items={items}
    itemToImage={(item) => item.originalImageFile}
    displaySize={{ displayWidth: 180, displayHeight: 225 }}
    onClick={onClick}
  />
);
