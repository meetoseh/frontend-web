import { ReactElement } from 'react';
import { SimpleImageFilesChoice } from '../../../shared/upload/selector/SimpleImageFilesChoice';
import { CourseHeroImage } from './CourseHeroImage';

/**
 * Presents a list of course hero images, allowing the user to
 * select one.
 */
export const CourseHeroImageList = ({
  items,
  onClick,
}: {
  items: CourseHeroImage[];
  onClick: (item: CourseHeroImage) => void;
}): ReactElement => (
  <SimpleImageFilesChoice
    items={items}
    itemToImage={(item) => item.imageFile}
    displaySize={{ displayWidth: 180, displayHeight: 180 }}
    onClick={onClick}
  />
);
