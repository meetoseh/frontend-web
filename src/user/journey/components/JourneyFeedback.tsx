import { ReactElement, useCallback } from 'react';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import styles from './JourneyFeedback.module.css';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { JourneyFeedbackButton } from './JourneyFeedbackButton';
import { setVWC } from '../../../shared/lib/setVWC';
import { alphaBlend } from '../../../shared/lib/colorUtils';

export type JourneyFeedbackProps = {
  /**
   * The current response, or null if the user has not selected a response.
   * When the user taps one of the ratings, we set this value.
   *
   * 1. hated
   * 2. disliked
   * 3. liked
   * 4. loved
   */
  response: WritableValueWithCallbacks<number | null>;

  /**
   * The average color of the background, expressed as 0-1 RGB values.
   */
  backgroundAverageRGB: ValueWithCallbacks<[number, number, number]>;
};

/**
 * Shows a row of buttons that the user can choose from to describe how
 * they felt about the journey.
 */
export const JourneyFeedback = ({
  response: responseVWC,
  backgroundAverageRGB,
}: JourneyFeedbackProps): ReactElement => {
  const hated = useMappedValueWithCallbacks(responseVWC, (r) => r === 4);
  const disliked = useMappedValueWithCallbacks(responseVWC, (r) => r === 3);
  const liked = useMappedValueWithCallbacks(responseVWC, (r) => r === 2);
  const loved = useMappedValueWithCallbacks(responseVWC, (r) => r === 1);

  const onPressHated = useCallback(() => setVWC(responseVWC, 4), [responseVWC]);
  const onPressDisliked = useCallback(() => setVWC(responseVWC, 3), [responseVWC]);
  const onPressLiked = useCallback(() => setVWC(responseVWC, 2), [responseVWC]);
  const onPressLoved = useCallback(() => setVWC(responseVWC, 1), [responseVWC]);

  const buttonBackground = useMappedValueWithCallbacks(backgroundAverageRGB, (bknd) =>
    alphaBlend(bknd, [1, 1, 1, 0.15])
  );

  return (
    <div className={styles.container}>
      <JourneyFeedbackButton
        selected={hated}
        emoji="☹️"
        label="Hated"
        onPress={onPressHated}
        background={buttonBackground}
      />
      <JourneyFeedbackButton
        selected={disliked}
        emoji="😕"
        label="Disliked"
        onPress={onPressDisliked}
        background={buttonBackground}
      />
      <JourneyFeedbackButton
        selected={liked}
        emoji="😌"
        label="Liked"
        onPress={onPressLiked}
        background={buttonBackground}
      />
      <JourneyFeedbackButton
        selected={loved}
        emoji="😍"
        label="Loved"
        onPress={onPressLoved}
        background={buttonBackground}
      />
    </div>
  );
};
