import { ReactElement, useMemo, useState } from 'react';
import { ErrorBlock } from '../../shared/forms/ErrorBlock';
import { SplashScreen } from '../splash/SplashScreen';
import { useJourneyShared } from './hooks/useJourneyShared';
import { JourneyRef } from './models/JourneyRef';
import { JourneyScreenProps } from './models/JourneyScreenProps';
import { Journey } from './screens/Journey';
import { JourneyLobbyScreen } from './screens/JourneyLobbyScreen';
import { JourneyPostScreen } from './screens/JourneyPostScreen';
import { JourneyShareScreen } from './screens/JourneyShareScreen';
import { JourneyStart } from './screens/JourneyStart';

type JourneyRouterProps = {
  /**
   * The journey we are pushing the user through the flow of
   */
  journey: JourneyRef;

  /**
   * The function to call when the user is done with the journey.
   */
  onFinished: () => void;
};

export type JourneyRouterScreenId = 'lobby' | 'start' | 'journey' | 'post' | 'share';

export const JourneyRouter = ({ journey, onFinished }: JourneyRouterProps): ReactElement => {
  const [screen, setScreen] = useState<JourneyRouterScreenId>('lobby');
  const sharedState = useJourneyShared(journey);
  const screenProps: JourneyScreenProps = useMemo(() => {
    return {
      journey,
      shared: sharedState,
      setScreen,
      onJourneyFinished: onFinished,
    };
  }, [journey, sharedState, onFinished]);

  if (sharedState?.audio?.error !== null && sharedState?.audio?.error !== undefined) {
    return <ErrorBlock>{sharedState.audio.error}</ErrorBlock>;
  }

  if (sharedState.imageLoading) {
    return <SplashScreen />;
  }

  if (screen === 'lobby') {
    return <JourneyLobbyScreen {...screenProps} />;
  }

  if (!sharedState.audio?.loaded) {
    return <SplashScreen />;
  }

  if (screen === 'start') {
    return <JourneyStart {...screenProps} />;
  }

  if (screen === 'journey') {
    return <Journey {...screenProps} />;
  }

  if (sharedState.blurredImageLoading) {
    return <SplashScreen />;
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