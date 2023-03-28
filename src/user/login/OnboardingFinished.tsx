import { ReactElement } from 'react';

type OnboardingFinishedProps = {
  /**
   * The function to call to return the user to the home screen.
   */
  onFinished: () => void;
};

/**
 * The screen that is shown when the user has finished the onboarding experience.
 */
export const OnboardingFinished = ({ onFinished }: OnboardingFinishedProps): ReactElement => {
  return <>onboarding finished</>;
};
