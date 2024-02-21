import { ReactElement } from 'react';
import { SimpleImageFilesChoice } from '../../../shared/upload/selector/SimpleImageFilesChoice';
import { CourseLogo } from './CourseLogo';

/**
 * Presents a list of course logo images, allowing the user to
 * select one.
 */
export const CourseLogoList = ({
  items,
  onClick,
}: {
  items: CourseLogo[];
  onClick: (item: CourseLogo) => void;
}): ReactElement => (
  <SimpleImageFilesChoice
    items={items}
    itemToImage={(item) => item.imageFile}
    displaySize={{
      displayWidth: 180,
      displayHeight: null,
      compareAspectRatio: (a, b) => a.height / a.width - b.height / b.width,
    }}
    onClick={onClick}
  />
);
