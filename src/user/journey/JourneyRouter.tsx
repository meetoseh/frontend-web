import { ReactElement, useEffect, useMemo, useState } from 'react';
import { getJwtExpiration } from '../../shared/lib/getJwtExpiration';
import { useJourneyShared } from './hooks/useJourneyShared';
import { JourneyRef } from './models/JourneyRef';
import { JourneyScreenProps } from './models/JourneyScreenProps';
import { Journey } from './screens/Journey';
import { JourneyLobbyScreen } from './screens/JourneyLobbyScreen';
import { JourneyPostScreen } from './screens/JourneyPostScreen';
import { JourneyShareScreen } from './screens/JourneyShareScreen';
import { JourneyStartScreen } from './screens/JourneyStartScreen';
import { JourneyFeedbackScreen } from './screens/JourneyFeedbackScreen';
import { getCurrentServerTimeMS } from '../../shared/lib/getCurrentServerTimeMS';

type JourneyRouterProps = {
  /**
   * The journey we are pushing the user through the flow of
   */
  journey: JourneyRef;

  /**
   * The function to call when the user is done with the journey.
   */
  onFinished: () => void;

  /**
   * True if this is an onboarding journey, false otherwise.
   */
  isOnboarding: boolean;
};

export type JourneyRouterScreenId = 'lobby' | 'start' | 'journey' | 'feedback' | 'post' | 'share';

export const JourneyRouter = ({
  journey,
  onFinished,
  isOnboarding,
}: JourneyRouterProps): ReactElement => {
  const [screen, setScreen] = useState<JourneyRouterScreenId>('lobby');
  const sharedState = useJourneyShared({ type: 'react-rerender', props: journey });
  const screenProps: JourneyScreenProps = useMemo(() => {
    return {
      journey,
      shared: sharedState,
      setScreen: (screen, privileged) => {
        if (screen === 'journey') {
          if (!privileged) {
            console.warn('setScreen unprivileged to journey, treating as start');
            setScreen('start');
            return;
          }

          const audio = sharedState.get().audio;
          if (!audio.loaded || audio.play === null || audio.audio === null) {
            console.warn('setScreen to journey, but audio not loaded. going to start');
            setScreen('start');
            return;
          }

          audio.play();
          setScreen('journey');
          return;
        }

        setScreen(screen);
      },
      onJourneyFinished: onFinished,
      isOnboarding,
    };
  }, [journey, sharedState, onFinished, isOnboarding]);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    let active = true;

    queueTimeout();

    return () => {
      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    async function queueTimeout() {
      const now = await getCurrentServerTimeMS();
      if (!active) {
        return;
      }

      const expireTime = getJwtExpiration(journey.jwt);
      if (expireTime <= now) {
        onFinished();
        return;
      }

      timeout = setTimeout(handleExpiration, expireTime - now);
    }

    function handleExpiration() {
      if (!active) {
        return;
      }
      onFinished();
    }
  }, [journey.jwt, onFinished]);

  if (screen === 'lobby') {
    return <JourneyLobbyScreen {...screenProps} />;
  }

  if (screen === 'start') {
    return <JourneyStartScreen {...screenProps} />;
  }

  if (screen === 'journey') {
    return <Journey {...screenProps} />;
  }

  if (screen === 'feedback') {
    return <JourneyFeedbackScreen {...screenProps} />;
  }

  if (screen === 'post') {
    return <JourneyPostScreen {...screenProps} />;
  }

  if (screen === 'share') {
    return <JourneyShareScreen {...screenProps} />;
  }
  return handleUnknownScreen(screen);
};

// used to tell the type system that this should never happen;
// notice how if you remove a case above, you'll get a compile error
const handleUnknownScreen = (screen: never): never => {
  throw new Error(`Unknown journey screen ${screen}`);
};
