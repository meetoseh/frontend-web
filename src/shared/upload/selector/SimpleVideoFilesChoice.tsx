import { ReactElement } from 'react';
import { OsehContentRef } from '../../content/OsehContentRef';
import { VideoFilesChoice } from './VideoFilesChoice';
import { VideoFileChoice } from './VideoFileChoice';
import { ContentFileWebExport } from '../../content/OsehContentTarget';

/**
 * Presents a list of videos, allowing the user to select one.
 */
export const SimpleVideoFilesChoice = <T extends object>({
  items,
  itemToVideo,
  onClick,
  comparer,
}: {
  items: T[];
  itemToVideo: (item: T) => OsehContentRef;
  onClick: (item: T) => void;
  comparer?: (a: ContentFileWebExport, b: ContentFileWebExport) => number;
}): ReactElement => {
  return (
    <VideoFilesChoice>
      {items.map((item) => (
        <VideoFileChoice
          key={itemToVideo(item).uid}
          video={itemToVideo(item)}
          comparer={comparer}
          onClick={() => onClick(item)}
        />
      ))}
    </VideoFilesChoice>
  );
};
