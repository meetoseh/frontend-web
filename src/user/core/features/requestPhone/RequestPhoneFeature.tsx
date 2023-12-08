import { useContext } from 'react';
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
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';

export const RequestPhoneFeature: Feature<RequestPhoneState, RequestPhoneResources> = {
  identifier: 'requestPhone',

  useWorldState: () => {
    const loginContextRaw = useContext(LoginContext);
    const phoneNumberMissing = useMappedValueWithCallbacks(
      loginContextRaw.value,
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return false;
        }

        return loginContextUnch.userAttributes.phoneNumber === null;
      }
    );

    const phoneNumberIAN = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({
        uid: 'oseh_ian_ENUob52K4t7HTs7idvR7Ig',
        suppress: !phoneNumberMissing.get(),
      }),
      callbacks: phoneNumberMissing.callbacks,
    });
    const onboardingPhoneNumberIAN = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({
        uid: 'oseh_ian_bljOnb8Xkxt-aU9Fm7Qq9w',
        suppress: !phoneNumberMissing.get(),
      }),
      callbacks: phoneNumberMissing.callbacks,
    });

    const hadPhoneNumber = useWritableValueWithCallbacks<{ sub: string; hadPn: boolean } | null>(
      () => null
    );
    useValueWithCallbacksEffect(loginContextRaw.value, (loginContextUnch) => {
      if (loginContextUnch.state === 'loading') {
        return undefined;
      }

      if (loginContextUnch.state === 'logged-out') {
        setVWC(hadPhoneNumber, null);
        return undefined;
      }

      const curr = hadPhoneNumber.get();
      if (curr !== null && curr.sub === loginContextUnch.userAttributes.sub) {
        return;
      }

      setVWC(hadPhoneNumber, {
        sub: loginContextUnch.userAttributes.sub,
        hadPn: loginContextUnch.userAttributes.phoneNumber !== null,
      });
    });

    const justAddedPhoneNumber = useMappedValuesWithCallbacks(
      [hadPhoneNumber, loginContextRaw.value],
      () => {
        const hadPn = hadPhoneNumber.get();
        const loginContextUnch = loginContextRaw.value.get();

        if (loginContextUnch.state !== 'logged-in') {
          return false;
        }

        const hasPn = loginContextUnch.userAttributes.phoneNumber !== null;
        return !hadPn && hasPn;
      }
    );

    return useMappedValuesWithCallbacks(
      [phoneNumberIAN, onboardingPhoneNumberIAN, justAddedPhoneNumber, phoneNumberMissing],
      (): RequestPhoneState => ({
        phoneNumberIAN: phoneNumberIAN.get(),
        onboardingPhoneNumberIAN: onboardingPhoneNumberIAN.get(),
        hasPhoneNumber: !phoneNumberMissing.get(),
        justAddedPhoneNumber: justAddedPhoneNumber.get(),
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
