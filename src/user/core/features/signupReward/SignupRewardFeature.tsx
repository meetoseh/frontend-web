import { useContext } from 'react';
import { Feature } from '../../models/Feature';
import { SignupRewardResources } from './SignupRewardResources';
import { SignupRewardState } from './SignupRewardState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { SignupReward } from './SignupReward';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';

export const SignupRewardFeature: Feature<SignupRewardState, SignupRewardResources> = {
  identifier: 'signupReward',
  useWorldState: () => {
    const ian = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_7_3gJYejCkpQTunjRcw-Mg', suppress: false },
    });

    return useMappedValueWithCallbacks(ian, (ian) => ({
      ian: ian,
      isPreLoginInterest: false,
    }));
  },
  useResources: (state, required) => {
    const loginContextRaw = useContext(LoginContext);
    const session = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: state.get().ian?.uid ?? null }),
      callbacks: state.callbacks,
    });
    const givenNameVWC = useMappedValueWithCallbacks(loginContextRaw.value, (v) => {
      if (v.state !== 'logged-in') {
        return null;
      }
      return v.userAttributes.givenName;
    });
    const images = useOsehImageStateRequestHandler({});
    const interestsRaw = useContext(InterestsContext);
    const interestsVWC = useReactManagedValueAsValueWithCallbacks(interestsRaw);
    const image = useOsehImageStateValueWithCallbacks(
      adaptValueWithCallbacksAsVariableStrategyProps(
        useMappedValuesWithCallbacks([required, interestsVWC], () => ({
          uid: (() => {
            if (!required.get()) {
              return null;
            }

            const interests = interestsVWC.get();
            if (interests.state === 'loading') {
              return null;
            }

            if (interests.state === 'loaded' && interests.primaryInterest === 'isaiah-course') {
              return 'oseh_if_utnIdo3z0V65FnFSc-Rs-g';
            }

            return 'oseh_if_F7sVhs4BJ7nnhPjyhi09-g';
          })(),
          jwt: null,
          displayWidth: 336,
          displayHeight: 184,
          alt: '',
          isPublic: true,
        }))
      ),
      images
    );

    return useMappedValuesWithCallbacks([session, givenNameVWC, image, interestsVWC], () => ({
      session: session.get(),
      givenName: givenNameVWC.get(),
      image: image.get(),
      loading: image.get().loading || interestsVWC.get().state === 'loading',
    }));
  },

  isRequired: (worldState, allStates) => {
    if (allStates.confirmMergeAccount.mergedThisSession) {
      return false;
    }

    if (worldState.ian === null) {
      return undefined;
    }
    if (worldState.isPreLoginInterest === undefined) {
      return undefined;
    }

    return !worldState.isPreLoginInterest && worldState.ian.showNow;
  },

  component: (worldState, resources) => <SignupReward state={worldState} resources={resources} />,
};
