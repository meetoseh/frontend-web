import { ReactElement, useMemo } from 'react';
import styles from './BannerValuePropsScreen.module.css';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { Button } from '../../../shared/forms/Button';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';

type BannerValuePropsScreenProps = {
  /**
   * The title for the screen, defaults to Reduce anxiety and find your calm
   */
  title?: ReactElement | string;
  /**
   * The value propositions, by default
   * - 100s of classes to reduce anxiety, manage panic attacks, and sleep better
   * - Bite-sized content from 1-3 minutes
   * - Backed by research
   */
  valueProps?: (ReactElement | string)[];
  /**
   * The uid of the public image to use in the banner section,
   * defaults to oseh_if_F7sVhs4BJ7nnhPjyhi09-g
   */
  bannerImageUid?: string;
  /**
   * The handler for when the continue button is clicked, or a string to have
   * the button be an anchor tag going to the specified url.
   */
  onContinue: React.MouseEventHandler<HTMLButtonElement> | string;

  /** The image handler to use */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Shows a checklist screen with a banner image, intended for value propositions
 */
export const BannerValuePropsScreen = ({
  title: titleRaw,
  valueProps: valuePropsRaw,
  bannerImageUid,
  onContinue,
  imageHandler,
}: BannerValuePropsScreenProps): ReactElement => {
  const title = titleRaw ?? (
    <>
      Reduce anxiety,
      <br />
      <em>Find your calm</em>
    </>
  );
  const valueProps = useMemo(() => {
    return (
      valuePropsRaw ?? [
        <>100s of classes to reduce anxiety, manage panic attacks, and sleep better</>,
        <>Bite-sized content from 1-3 minutes</>,
        <>Backed by research</>,
      ]
    );
  }, [valuePropsRaw]);

  const bannerImageVWC = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        uid: bannerImageUid ?? 'oseh_if_F7sVhs4BJ7nnhPjyhi09-g',
        jwt: null,
        displayWidth: 336,
        displayHeight: 184,
        alt: '',
        isPublic: true,
        placeholderColor: '#000000',
      },
    },
    imageHandler
  );

  const windowSize = useWindowSize();

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <div className={styles.background} style={windowSize} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.horizontalRule} />
        <div className={styles.checkList}>
          {valueProps.map((valueProp, index) => (
            <div className={styles.checkListItem} key={index}>
              <div className={styles.checkListItemCheck} />
              <div className={styles.checkListItemContent}>{valueProp}</div>
            </div>
          ))}
        </div>
        <div className={styles.bannerContainer}>
          <OsehImageFromStateValueWithCallbacks state={bannerImageVWC} />
        </div>
        <div className={styles.submitOuterContainer}>
          <div className={styles.submitContainer}>
            <Button type="button" variant="filled-white" fullWidth onClick={onContinue}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
