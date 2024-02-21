import { ReactElement } from 'react';
import { CourseVideo } from './CourseVideo';
import { SimpleVideoFilesChoice } from '../../../shared/upload/selector/SimpleVideoFilesChoice';
import { createVideoSizeComparerForTarget } from '../../../shared/content/createVideoSizeComparerForTarget';

/**
 * Presents a list of course videos, allowing the user to
 * select one.
 */
export const CourseVideoList = ({
  items,
  onClick,
}: {
  items: CourseVideo[];
  onClick: (item: CourseVideo) => void;
}): ReactElement => (
  <SimpleVideoFilesChoice
    items={items}
    itemToVideo={(item) => item.contentFile}
    comparer={createVideoSizeComparerForTarget(180, 320)}
    onClick={onClick}
  />
);
