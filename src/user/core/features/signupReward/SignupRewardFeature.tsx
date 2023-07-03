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

const bannerImageUid = 'oseh_if_F7sVhs4BJ7nnhPjyhi09-g';

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
    const loginContext = useContext(LoginContext);
    const session = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: state.get().ian?.uid ?? null }),
      callbacks: state.callbacks,
    });
    const givenNameRaw = loginContext.userAttributes?.givenName ?? null;
    const givenNameVWC = useReactManagedValueAsValueWithCallbacks(givenNameRaw);
    const images = useOsehImageStateRequestHandler({});
    const image = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => ({
          uid: required.get() ? bannerImageUid : null,
          jwt: null,
          displayWidth: 336,
          displayHeight: 184,
          alt: '',
          isPublic: true,
        }),
        callbacks: required.callbacks,
      },
      images
    );
    const interestsRaw = useContext(InterestsContext);
    const interestsVWC = useReactManagedValueAsValueWithCallbacks(interestsRaw);

    return useMappedValuesWithCallbacks([session, givenNameVWC, image, interestsVWC], () => ({
      session: session.get(),
      givenName: givenNameVWC.get(),
      image: image.get(),
      loading: image.get().loading || interestsVWC.get().state === 'loading',
    }));
  },

  isRequired: (worldState) => {
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
