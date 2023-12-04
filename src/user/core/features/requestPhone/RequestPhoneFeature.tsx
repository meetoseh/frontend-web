import { useContext, useRef } from 'react';
import { Feature } from '../../models/Feature';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { RequestPhoneResources } from './RequestPhoneResources';
import { RequestPhoneState } from './RequestPhoneState';
import { RequestPhone } from './RequestPhone';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';

export const RequestPhoneFeature: Feature<RequestPhoneState, RequestPhoneResources> = {
  identifier: 'requestPhone',

  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const phoneNumberIAN = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: {
        uid: 'oseh_ian_ENUob52K4t7HTs7idvR7Ig',
        suppress: loginContext.userAttributes?.phoneNumber !== null,
      },
    });
    const onboardingPhoneNumberIAN = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: {
        uid: 'oseh_ian_bljOnb8Xkxt-aU9Fm7Qq9w',
        suppress: loginContext.userAttributes?.phoneNumber !== null,
      },
    });
    const hasPhoneNumber = useWritableValueWithCallbacks<boolean>(() => false);

    const realHasPhoneNumber = loginContext.userAttributes?.phoneNumber !== null;
    if (realHasPhoneNumber !== hasPhoneNumber.get()) {
      hasPhoneNumber.set(realHasPhoneNumber);
      hasPhoneNumber.callbacks.call(undefined);
    }

    const realUserSub = loginContext.userAttributes?.sub;
    const userSub = useWritableValueWithCallbacks<string | undefined>(() => realUserSub);
    if (realUserSub !== userSub.get()) {
      userSub.set(realUserSub);
      userSub.callbacks.call(undefined);
    }

    const hadPhoneNumber = useRef({
      sub: realUserSub,
      hadPn: realHasPhoneNumber,
    });
    if (hadPhoneNumber.current.sub !== realUserSub) {
      hadPhoneNumber.current = {
        sub: realUserSub,
        hadPn: realHasPhoneNumber,
      };
    }

    const justAddedPhoneNumber = useMappedValuesWithCallbacks(
      [hasPhoneNumber, userSub],
      (): string | null => {
        if (hadPhoneNumber.current.hadPn) {
          return null;
        }

        if (hasPhoneNumber.get() && realUserSub !== undefined) {
          return realUserSub;
        }

        return null;
      }
    );

    return useMappedValuesWithCallbacks(
      [phoneNumberIAN, onboardingPhoneNumberIAN, justAddedPhoneNumber, hasPhoneNumber, userSub],
      (): RequestPhoneState => ({
        phoneNumberIAN: phoneNumberIAN.get(),
        onboardingPhoneNumberIAN: onboardingPhoneNumberIAN.get(),
        hasPhoneNumber: hasPhoneNumber.get(),
        justAddedPhoneNumber: justAddedPhoneNumber.get() === userSub.get(),
      })
    );
  },

  useResources: (state, required) => {
    const ianUID = useMappedValueWithCallbacks(state, (s) =>
      s.phoneNumberIAN?.showNow
        ? s.phoneNumberIAN.uid
        : s.onboardingPhoneNumberIAN?.showNow
        ? s.onboardingPhoneNumberIAN.uid
        : null
    );
    const session = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: ianUID.get() }),
      callbacks: ianUID.callbacks,
    });
    const interestsRaw = useContext(InterestsContext);
    const interestsVWC = useReactManagedValueAsValueWithCallbacks(interestsRaw);

    return useMappedValuesWithCallbacks([session, interestsVWC], () => ({
      session: session.get(),
      loading: interestsVWC.get().state === 'loading',
    }));
  },

  isRequired: (worldState, allStates) => {
    if (allStates.confirmMergeAccount.mergedThisSession) {
      return false;
    }

    if (worldState.hasPhoneNumber === undefined) {
      return undefined;
    }

    if (worldState.hasPhoneNumber) {
      return false;
    }

    if (worldState.phoneNumberIAN === null) {
      return undefined;
    }

    if (worldState.phoneNumberIAN.showNow) {
      return true;
    }

    if (worldState.onboardingPhoneNumberIAN === null) {
      return undefined;
    }

    return (
      allStates.pickEmotionJourney.classesTakenThisSession > 0 &&
      worldState.onboardingPhoneNumberIAN.showNow
    );
  },

  component: (worldState, resources) => <RequestPhone state={worldState} resources={resources} />,
};
