import { useContext, useMemo } from 'react';
import { Feature } from '../../models/Feature';
import { SignupRewardResources } from './SignupRewardResources';
import { SignupRewardState } from './SignupRewardState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { SignupReward } from './SignupReward';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';

const bannerImageUid = 'oseh_if_F7sVhs4BJ7nnhPjyhi09-g';

export const SignupRewardFeature: Feature<SignupRewardState, SignupRewardResources> = {
  identifier: 'signupReward',
  useWorldState: () => {
    const signupIAP = useInappNotification('oseh_ian_7_3gJYejCkpQTunjRcw-Mg', false);
    const interests = useContext(InterestsContext);

    const isPreLoginInterest = (() => {
      if (interests.state === 'loading') {
        return undefined;
      }

      if (interests.state === 'unavailable') {
        return false;
      }

      return interests.primaryInterest === 'anxiety';
    })();

    return useMemo(() => ({ signupIAP, isPreLoginInterest }), [signupIAP, isPreLoginInterest]);
  },
  useResources: (state, required) => {
    const loginContext = useContext(LoginContext);
    const session = useInappNotificationSession(state.signupIAP?.uid ?? null);
    const givenName = loginContext.userAttributes?.givenName ?? null;
    const images = useOsehImageStateRequestHandler({});
    const image = useOsehImageState(
      {
        uid: required ? bannerImageUid : null,
        jwt: null,
        displayWidth: 336,
        displayHeight: 184,
        alt: '',
        isPublic: true,
      },
      images
    );
    const interests = useContext(InterestsContext);

    return useMemo<SignupRewardResources>(
      () => ({
        session,
        givenName,
        image,
        loading: image.loading || interests.state === 'loading',
      }),
      [session, givenName, image, interests.state]
    );
  },

  isRequired: (worldState) => {
    if (worldState.signupIAP === null) {
      return undefined;
    }
    if (worldState.isPreLoginInterest === undefined) {
      return undefined;
    }

    return !worldState.isPreLoginInterest && worldState.signupIAP.showNow;
  },

  component: (worldState, resources, doAnticipateState) => (
    <SignupReward state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
