import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { SingleJourneyResources } from './SingleJourneyResources';
import { SingleJourneyState } from './SingleJourneyState';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { JourneyScreenProps } from '../../../journey/models/JourneyScreenProps';
import { JourneyRef } from '../../../journey/models/JourneyRef';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { JourneyLobbyScreen } from '../../../journey/screens/JourneyLobbyScreen';
import { JourneyStartScreen } from '../../../journey/screens/JourneyStartScreen';
import { Journey } from '../../../journey/screens/Journey';
import { JourneyFeedbackScreen } from '../../../journey/screens/JourneyFeedbackScreen';
import { JourneyPostScreen } from '../../../journey/screens/JourneyPostScreen';

export const SingleJourney = ({
  state,
  resources,
}: FeatureComponentProps<SingleJourneyState, SingleJourneyResources>): ReactElement => {
  const journeyVWC = useMappedValueWithCallbacks(
    state,
    (s): JourneyRef | null => s.show?.ref ?? null
  );
  const sharedVWC = useMappedValueWithCallbacks(resources, (r) => r.journeyShared);
  const screenVWC = useMappedValueWithCallbacks(resources, (r) => r.step);

  const journeyAndScreenVWC = useMappedValuesWithCallbacks([journeyVWC, screenVWC], () => ({
    journey: journeyVWC.get(),
    screen: screenVWC.get(),
  }));

  return (
    <RenderGuardedComponent
      props={journeyAndScreenVWC}
      component={({ journey, screen }) => {
        if (journey === null) {
          return <></>;
        }

        const screenProps: JourneyScreenProps = {
          journey,
          shared: sharedVWC,
          setScreen: (screen, privileged) => {
            const setScreen = resources.get().setStep;
            if (screen === 'journey') {
              if (!privileged) {
                console.warn('setScreen unprivileged to journey, treating as start');
                setScreen('start');
                return;
              }

              const audio = sharedVWC.get().audio;
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
          onJourneyFinished: () => state.get().setShow(null),
          isOnboarding: false,
          takeAnother: null,
        };

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

        ((s: never) => {
          throw new Error(`Unknown journey screen ${s}`);
        })(screen);
      }}
    />
  );
};
