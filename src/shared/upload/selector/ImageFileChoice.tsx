import { OsehImageFromStateValueWithCallbacks } from '../../images/OsehImageFromStateValueWithCallbacks';
import { OsehImageState } from '../../images/OsehImageState';
import { ValueWithCallbacks } from '../../lib/Callbacks';
import styles from './ImageFileChoice.module.css';

export type ImageFileChoiceProps = {
  /**
   * The image to show
   */
  image: ValueWithCallbacks<OsehImageState>;

  /**
   * The function to call when the image is clicked
   */
  onClick: () => void;
};

/**
 * The standard way to display an image file choice, which just shows
 * the image and calls the given function when it is clicked.
 */
export const ImageFileChoice = ({ image, onClick }: ImageFileChoiceProps) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={styles.button}>
      <OsehImageFromStateValueWithCallbacks state={image} />
    </button>
  );
};
