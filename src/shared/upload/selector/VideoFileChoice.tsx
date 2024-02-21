import { OsehContent } from '../../content/OsehContent';
import { OsehContentRef } from '../../content/OsehContentRef';
import styles from './VideoFileChoice.module.css';
import { Button } from '../../forms/Button';
import { ContentFileWebExport } from '../../content/OsehContentTarget';

export type VideoFileChoiceProps = {
  /**
   * The video to show
   */
  video: OsehContentRef;

  /**
   * Used to determine which export is preferred; negative for a is better, positive for b is better,
   * and 0 for equal. If unspecified, we prefer higher bandwidth
   */
  comparer?: (a: ContentFileWebExport, b: ContentFileWebExport) => number;

  /**
   * The function to call when the video is selected
   */
  onClick: () => void;
};

/**
 * The standard way to display an video file choice, which shows the
 * video file with controls and a select button which calls the given function
 * when clicked.
 */
export const VideoFileChoice = ({ video, comparer, onClick }: VideoFileChoiceProps) => {
  return (
    <div className={styles.container}>
      <OsehContent uid={video.uid} jwt={video.jwt} targetComparer={comparer} showAs="video" />
      <div className={styles.selectContainer}>
        <Button
          type="button"
          variant="outlined"
          onClick={(e) => {
            e.preventDefault();
            onClick();
          }}>
          Select
        </Button>
      </div>
    </div>
  );
};
