import { useCallback, useState } from 'react';
import { FactWithTitleScreen } from './screens/FactWithTitleScreen';
import { HeadshotScreen } from './screens/HeadshotScreen';
import { BannerValuePropsScreen } from './screens/BannerValuePropsScreen';

type Step = 'bannerVPs' | 'fact' | 'headshot';

/**
 * The landing page for users acquired via anxiety-related marketing.
 * Assumed to be wrapped in a login / interest context.
 */
export const AnxietyLanding = () => {
  const [step, setStep] = useState<Step>('bannerVPs');

  const gotoFact = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStep('fact');
  }, []);

  const gotoHeadshot = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStep('headshot');
  }, []);

  if (step === 'bannerVPs') {
    return <BannerValuePropsScreen onContinue={gotoFact} />;
  } else if (step === 'fact') {
    return <FactWithTitleScreen onContinue={gotoHeadshot} />;
  } else {
    return (
      <HeadshotScreen
        headshotUid="oseh_if_pZHgy82qwFj2YvTdn7RgEw"
        quote={
          <>
            &#x201C;OMG I absolutely love Oseh. I was having panic and anxiety episodes and these 1
            min techniques have really helped me.... I use the site every day.&#x201D;
          </>
        }
        name="Patricia Lee"
      />
    );
  }
};
