import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
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
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const refVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.show?.ref ?? null, {
      outputEqualityFn: Object.is,
    });
    const sharedVWC = useJourneyShared(adaptValueWithCallbacksAsVariableStrategyProps(refVWC));
    const stepVWC = useWritableValueWithCallbacks<{
      uid: string | null;
      screen: JourneyRouterScreenId;
    }>(() => ({ uid: null, screen: 'lobby' }));
    const showVWC = useMappedValueWithCallbacks(stateVWC, (s) => s.show);

    useValueWithCallbacksEffect(refVWC, (r) => {
      if (r === null) {
        setVWC(stepVWC, { uid: null, screen: 'lobby' });
      }
      return undefined;
    });

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
          onJourneyFinished: () => {
            allStatesVWC.get().homeScreen.onClassTaken();
            allStatesVWC.get().homeScreen.streakInfo.refresh?.();
            stateVWC.get().setShow(null);
          },
          onTakeAnother: () => {
            allStatesVWC.get().homeScreen.onClassTaken();
            allStatesVWC.get().homeScreen.streakInfo.refresh?.();
            if (show?.type === 'emotion') {
              allStatesVWC
                .get()
                .gotoEmotion.setShow({ emotion: show.emotion, anticipatory: false }, true);
            }
            stateVWC.get().setShow(null);
          },
        };
      }
    );
  },
  component: (state, resources) => <SingleJourney state={state} resources={resources} />,
};
