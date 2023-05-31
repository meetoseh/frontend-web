import { useContext, useEffect, useMemo, useState } from 'react';
import { OnboardingStep } from '../../models/OnboardingStep';
import { SignupRewardResources } from './SignupRewardResources';
import { SignupRewardState } from './SignupRewardState';
import { LoginContext } from '../../../../shared/LoginContext';
import {
  OsehImageProps,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
} from '../../../../shared/OsehImage';
import { SignupReward } from './SignupReward';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/InterestsContext';

const bannerImageUid = 'oseh_if_F7sVhs4BJ7nnhPjyhi09-g';

export const SignupRewardStep: OnboardingStep<SignupRewardState, SignupRewardResources> = {
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
    const images = useOsehImageStatesRef({});
    const [image, setImage] = useState<OsehImageState | null>(null);
    const interests = useContext(InterestsContext);

    useEffect(() => {
      const oldProps = images.handling.current.get(bannerImageUid);
      if (!required) {
        if (oldProps !== undefined) {
          images.handling.current.delete(bannerImageUid);
          images.onHandlingChanged.current.call({
            old: oldProps,
            current: null,
            uid: bannerImageUid,
          });
        }
        return;
      }

      if (oldProps?.displayWidth === 336 && oldProps?.displayHeight === 184) {
        return;
      }

      const newProps: OsehImageProps = {
        uid: bannerImageUid,
        jwt: null,
        displayWidth: 336,
        displayHeight: 184,
        alt: '',
        isPublic: true,
      };

      images.handling.current.set(bannerImageUid, newProps);
      images.onHandlingChanged.current.call({
        old: oldProps ?? null,
        current: newProps,
        uid: bannerImageUid,
      });
    }, [required, images]);

    useEffect(() => {
      const image = images.state.current.get(bannerImageUid);
      setImage(image ?? null);

      images.onStateChanged.current.add(handleStateChanged);
      return () => {
        images.onStateChanged.current.remove(handleStateChanged);
      };

      function handleStateChanged(e: OsehImageStateChangedEvent) {
        if (e.uid !== bannerImageUid) {
          return;
        }

        setImage(e.current);
      }
    }, [images]);

    return useMemo<SignupRewardResources>(
      () => ({
        session,
        givenName,
        image,
        loading: image === null || image.loading || interests.state === 'loading',
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
