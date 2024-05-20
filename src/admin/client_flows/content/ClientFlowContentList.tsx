import { ReactElement } from 'react';
import { SimpleVideoFilesChoice } from '../../../shared/upload/selector/SimpleVideoFilesChoice';
import { createVideoSizeComparerForTarget } from '../../../shared/content/createVideoSizeComparerForTarget';
import { ClientFlowContent } from './ClientFlowContent';
import { AudioFilesChoice } from '../../../shared/upload/selector/AudioFilesChoice';
import { AudioFileChoice } from '../../../shared/upload/selector/AudioFileChoice';

/**
 * Presents a list of client flow content, allowing the user to
 * select one.
 */
export const ClientFlowContentList = ({
  items,
  onClick,
  preview,
}: {
  items: ClientFlowContent[];
  onClick: (item: ClientFlowContent) => void;
  /** From the x-preview hint */
  preview:
    | {
        type: 'audio';
      }
    | {
        type: 'video';
        width: number;
        height: number;
      };
}): ReactElement =>
  preview.type === 'video' ? (
    <SimpleVideoFilesChoice
      items={items}
      itemToVideo={(item) => item.contentFile}
      comparer={createVideoSizeComparerForTarget(preview.width, preview.height)}
      onClick={onClick}
    />
  ) : (
    <AudioFilesChoice>
      {items.map((item) => (
        <AudioFileChoice
          key={item.uid}
          audio={item.contentFile}
          transcript={item.transcript ?? null}
          onClick={() => onClick(item)}
        />
      ))}
    </AudioFilesChoice>
  );
