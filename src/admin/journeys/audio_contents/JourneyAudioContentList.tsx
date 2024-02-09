import { ReactElement } from 'react';
import { AudioFileChoice } from '../../../shared/upload/selector/AudioFileChoice';
import { AudioFilesChoice } from '../../../shared/upload/selector/AudioFilesChoice';
import { JourneyAudioContent } from './JourneyAudioContent';

/**
 * Presents a list of journey audio content, allowing the user to
 * select one.
 */
export const JourneyAudioContentList = ({
  items,
  onClick,
}: {
  items: JourneyAudioContent[];
  onClick: (item: JourneyAudioContent) => void;
}): ReactElement => {
  return (
    <AudioFilesChoice>
      {items.map((item) => (
        <AudioFileChoice
          key={item.uid}
          audio={item.contentFile}
          transcript={item.transcript}
          onClick={() => onClick(item)}
        />
      ))}
    </AudioFilesChoice>
  );
};
