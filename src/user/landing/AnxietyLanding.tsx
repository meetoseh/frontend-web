import { useCallback, useState } from 'react';
import { FactWithTitleScreen } from './screens/FactWithTitleScreen';
import { HeadshotScreen } from './screens/HeadshotScreen';
import { LandingPreviewScreen } from './screens/LandingPreviewScreen';
import { AgendaScreen } from './screens/AgendaScreen';
import { BannerValuePropsScreen } from './screens/BannerValuePropsScreen';

type Step = 'preview' | 'agenda' | 'bannerVPs' | 'headshot';

/**
 * The landing page for users acquired via anxiety-related marketing.
 * Assumed to be wrapped in a login / interest context.
 */
export const AnxietyLanding = () => {
  const [step, setStep] = useState<Step>('preview');

  const gotoAgenda = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStep('agenda');
  }, []);

  const gotoBannerVPs = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStep('bannerVPs');
  }, []);

  const gotoHeadshot = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStep('headshot');
  }, []);

  if (step === 'preview') {
    return <LandingPreviewScreen onContinue={gotoAgenda} />;
  } else if (step === 'agenda') {
    return <AgendaScreen onContinue={gotoBannerVPs} />;
  } else if (step === 'bannerVPs') {
    return <BannerValuePropsScreen onContinue={gotoHeadshot} />;
  } else {
    return (
      <HeadshotScreen
        onContinue="/"
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
