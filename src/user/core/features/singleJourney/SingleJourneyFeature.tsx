import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { JourneyRouterScreenId } from '../../../journey/JourneyRouter';
import { useJourneyShared } from '../../../journey/hooks/useJourneyShared';
import { Feature } from '../../models/Feature';
import { SingleJourney } from './SingleJourney';
import { SingleJourneyContext } from './SingleJourneyContext';
import { SingleJourneyResources } from './SingleJourneyResources';
import { SingleJourneyState } from './SingleJourneyState';

export const SingleJourneyFeature: Feature<SingleJourneyState, SingleJourneyResources> = {
  identifier: 'singleJourney',
  useWorldState: () => {
    const showVWC = useWritableValueWithCallbacks<SingleJourneyContext | null>(() => null);

    return useMappedValuesWithCallbacks([showVWC], () => ({
      show: showVWC.get(),
      setShow: (show) => setVWC(showVWC, show),
    }));
  },
  isRequired: (state) => state.show !== null,
  useResources: (stateVWC, requiredVWC) => {
    const sharedVWC = useJourneyShared({
      type: 'callbacks',
      props: () => stateVWC.get().show?.ref ?? null,
      callbacks: stateVWC.callbacks,
    });
    const stepVWC = useWritableValueWithCallbacks<{
      uid: string | null;
      screen: JourneyRouterScreenId;
    }>(() => ({ uid: null, screen: 'lobby' }));
    const showVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.show);

    return useMappedValuesWithCallbacks(
      [showVWC, sharedVWC, stepVWC, requiredVWC],
      (): SingleJourneyResources => {
        const show = stateVWC.get().show;
        const shared = sharedVWC.get();
        const step = stepVWC.get();
        const req = requiredVWC.get();
        return {
          loading: !req || shared.darkenedImage.loading,
          step: show !== null && show.ref.uid === step.uid ? step.screen : 'lobby',
          journeyShared: shared,
          setStep: (screen) => setVWC(stepVWC, { uid: show?.ref.uid ?? null, screen }),
        };
      }
    );
  },
  component: (state, resources) => <SingleJourney state={state} resources={resources} />,
};
