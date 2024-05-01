import { ReactElement } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import styles from './FactWithTitleScreen.module.css';
import { DidYouKnow } from '../../../shared/components/DidYouKnow';
import { Button } from '../../../shared/forms/Button';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';

type FactWithTitleScreenProps = {
  /**
   * The title for the screen, defaults to
   * Get classes that suite your unique needs—everyday
   */
  title?: ReactElement | string;
  /**
   * The title of the fact, defaults to
   * Mindfulness can be as effective as medicine
   */
  factTitle?: ReactElement | string;
  /**
   * The fact, defaults to
   * Breathing and body exercises relieve anxiety as effectively as medications over an eight-week study of 208 people
   */
  fact?: ReactElement | string;
  /**
   * The handler for when the continue button is clicked, or a string to have
   * the button be an anchor tag going to the specified url.
   */
  onContinue: React.MouseEventHandler<HTMLButtonElement> | string;

  /** The image handler to use */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Shows a basic screen which consists of a title, fact, and continue button
 */
export const FactWithTitleScreen = ({
  title: titleRaw,
  factTitle: factTitleRaw,
  fact: factRaw,
  onContinue,
  imageHandler,
}: FactWithTitleScreenProps): ReactElement => {
  const title = titleRaw ?? (
    <>
      Get classes that suite your unique needs&#8212;<em>everyday</em>
    </>
  );
  const factTitle = factTitleRaw ?? <>Mindfulness works</>;
  const fact = factRaw ?? (
    <>
      Breathing and body exercises relieve anxiety as effectively as medications over an eight-week
      study of 208 people
    </>
  );

  const windowSize = useWindowSize();
  const backgroundVWC = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        uid: 'oseh_if_NOA1u2xYanYQlA8rdpPEQQ',
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
        placeholderColor: '#040b17',
      },
    },
    imageHandler
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks state={backgroundVWC} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <DidYouKnow title={factTitle}>{fact}</DidYouKnow>
        <div className={styles.buttonContainer}>
          <Button type="button" variant="filled-white" onClick={onContinue} fullWidth>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
