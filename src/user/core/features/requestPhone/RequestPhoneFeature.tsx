import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Feature } from '../../models/Feature';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { RequestPhoneResources } from './RequestPhoneResources';
import { RequestPhoneState } from './RequestPhoneState';
import { RequestPhone } from './RequestPhone';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';

const backgroundImageUid = 'oseh_if_hH68hcmVBYHanoivLMgstg';

export const RequestPhoneFeature: Feature<RequestPhoneState, RequestPhoneResources> = {
  identifier: 'requestPhone',

  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const phoneNumberIAN = useInappNotification(
      'oseh_ian_ENUob52K4t7HTs7idvR7Ig',
      loginContext.userAttributes?.phoneNumber !== null
    );
    const onboardingPhoneNumberIAN = useInappNotification(
      'oseh_ian_bljOnb8Xkxt-aU9Fm7Qq9w',
      loginContext.userAttributes?.phoneNumber !== null
    );
    const [justAddedPhoneNumber, setJustAddedPhoneNumber] = useState<string | null>(null);
    const hasPhoneNumber = loginContext.userAttributes?.phoneNumber !== null;

    const hadPhoneNumber = useRef({
      sub: loginContext.userAttributes?.sub,
      hadPn: hasPhoneNumber,
    });
    if (hadPhoneNumber.current.sub !== loginContext.userAttributes?.sub) {
      hadPhoneNumber.current = {
        sub: loginContext.userAttributes?.sub,
        hadPn: hasPhoneNumber,
      };
    }

    useEffect(() => {
      if (hadPhoneNumber.current.hadPn) {
        setJustAddedPhoneNumber(null);
      } else {
        if (hasPhoneNumber && loginContext.userAttributes?.sub !== undefined) {
          setJustAddedPhoneNumber(loginContext.userAttributes.sub);
        } else {
          setJustAddedPhoneNumber(null);
        }
      }
    }, [hasPhoneNumber, loginContext.userAttributes?.sub]);

    return useMemo<RequestPhoneState>(
      () => ({
        phoneNumberIAN,
        onboardingPhoneNumberIAN,
        hasPhoneNumber,
        justAddedPhoneNumber: justAddedPhoneNumber === loginContext.userAttributes?.sub,
      }),
      [
        phoneNumberIAN,
        onboardingPhoneNumberIAN,
        hasPhoneNumber,
        justAddedPhoneNumber,
        loginContext.userAttributes?.sub,
      ]
    );
  },

  useResources: (state, required) => {
    const images = useOsehImageStateRequestHandler({});
    const windowSize = useWindowSize();
    const session = useInappNotificationSession(
      state.phoneNumberIAN?.showNow
        ? state.phoneNumberIAN.uid
        : state.onboardingPhoneNumberIAN?.showNow
        ? state.onboardingPhoneNumberIAN.uid
        : null
    );
    const interests = useContext(InterestsContext);
    const background = useOsehImageState(
      {
        uid: required ? backgroundImageUid : null,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      },
      images
    );

    return useMemo<RequestPhoneResources>(
      () => ({
        session,
        background,
        loading: background.loading || interests.state === 'loading',
      }),
      [session, background, interests.state]
    );
  },

  isRequired: (worldState, allStates) => {
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

  component: (worldState, resources, doAnticipateState) => (
    <RequestPhone state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
