import { ReactElement } from 'react';
import { CourseVideoThumbnail } from './CourseVideoThumbnail';
import { SimpleImageFilesChoice } from '../../../../shared/upload/selector/SimpleImageFilesChoice';

/**
 * Presents a list of course video thumbnails, allowing the user to
 * select one.
 */
export const CourseVideoThumbnailImageList = ({
  items,
  onClick,
}: {
  items: CourseVideoThumbnail[];
  onClick: (item: CourseVideoThumbnail) => void;
}): ReactElement => (
  <SimpleImageFilesChoice
    items={items}
    itemToImage={(item) => item.imageFile}
    displaySize={{ displayWidth: 180, displayHeight: 368 }}
    onClick={onClick}
  />
);
