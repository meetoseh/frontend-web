import { useContext, useEffect, useMemo, useState } from 'react';
import { OnboardingStep } from '../../models/OnboardingStep';
import { LoginContext } from '../../../../shared/LoginContext';
import {
  OsehImageProps,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
} from '../../../../shared/OsehImage';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { usePublicInteractivePrompt } from '../../../../shared/hooks/usePublicInteractivePrompt';
import { RequestNotificationTimeState } from './RequestNotificationTimeState';
import { RequestNotificationTimeResources } from './RequestNotificationTimeResources';
import { apiFetch } from '../../../../shared/ApiConstants';
import { RequestNotificationTime } from './RequestNotificationTime';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const RequestNotificationTimeStep: OnboardingStep<
  RequestNotificationTimeState,
  RequestNotificationTimeResources
> = {
  identifier: 'requestNotificationTime',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const missingPhone =
      loginContext.state === 'loading'
        ? undefined
        : loginContext.state !== 'logged-in' ||
          loginContext.userAttributes === null ||
          loginContext.userAttributes.phoneNumber === null;
    const ian = useInappNotification('oseh_ian_aJs054IZzMnJE2ulbbyT6w', missingPhone ?? true);
    const [serverWantsNotificationTime, setServerWantsNotificationTime] = useState<
      boolean | undefined
    >(undefined);

    useEffect(() => {
      if (ian === null || !ian.showNow) {
        setServerWantsNotificationTime(undefined);
        return;
      }

      if (loginContext.state !== 'logged-in') {
        setServerWantsNotificationTime(undefined);
        return;
      }

      let active = true;
      askServer();
      return () => {
        active = false;
      };

      async function askServerInner() {
        const response = await apiFetch(
          '/api/1/users/me/wants_notification_time_prompt',
          {
            method: 'GET',
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        return data.wants_notification_time_prompt;
      }

      async function askServer() {
        try {
          const wantsPrompt = await askServerInner();
          if (active) {
            setServerWantsNotificationTime(wantsPrompt);
          }
        } catch (e) {
          if (active) {
            console.error('Server did not respond to wants_notification_time_prompt request: ', e);
            setServerWantsNotificationTime(false);
          }
          return;
        }
      }
    }, [loginContext, ian]);

    return useMemo<RequestNotificationTimeState>(
      () => ({
        ian,
        missingPhone,
        serverWantsNotificationTime,
      }),
      [ian, missingPhone, serverWantsNotificationTime]
    );
  },
  useResources: (worldState, required) => {
    const loginContext = useContext(LoginContext);
    const givenName = loginContext.userAttributes?.givenName ?? null;
    const images = useOsehImageStatesRef({});
    const windowSize = useWindowSize();
    const [background, setBackground] = useState<OsehImageState | null>(null);
    const session = useInappNotificationSession(worldState.ian?.uid ?? null);
    const prompt = usePublicInteractivePrompt({
      identifier: 'notification-time',
      load: required,
    });

    useEffect(() => {
      const oldProps = images.handling.current.get(backgroundImageUid);
      if (!required) {
        if (oldProps !== undefined) {
          images.handling.current.delete(backgroundImageUid);
          images.onHandlingChanged.current.call({
            old: oldProps,
            current: null,
            uid: backgroundImageUid,
          });
        }
        return;
      }

      if (
        oldProps?.displayWidth === windowSize.width &&
        oldProps?.displayHeight === windowSize.height
      ) {
        return;
      }

      const newProps: OsehImageProps = {
        uid: backgroundImageUid,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      };

      images.handling.current.set(backgroundImageUid, newProps);
      images.onHandlingChanged.current.call({
        old: oldProps ?? null,
        current: newProps,
        uid: backgroundImageUid,
      });
    }, [required, windowSize, images]);

    useEffect(() => {
      const background = images.state.current.get(backgroundImageUid);
      setBackground(background ?? null);

      images.onStateChanged.current.add(handleStateChanged);
      return () => {
        images.onStateChanged.current.remove(handleStateChanged);
      };

      function handleStateChanged(e: OsehImageStateChangedEvent) {
        if (e.uid !== backgroundImageUid) {
          return;
        }

        setBackground(e.current);
      }
    }, [images]);

    return useMemo<RequestNotificationTimeResources>(
      () => ({
        session,
        givenName,
        background,
        prompt: prompt,
        loading: background === null || background.loading,
      }),
      [session, givenName, background, prompt]
    );
  },

  isRequired: (worldState, allStates) => {
    if (allStates.pickEmotionJourney.classesTakenThisSession < 1) {
      return false;
    }

    if (worldState.missingPhone === undefined) {
      return undefined;
    }

    if (worldState.missingPhone) {
      return false;
    }

    if (worldState.ian === null) {
      return undefined;
    }

    if (worldState.ian.showNow && worldState.serverWantsNotificationTime === undefined) {
      return undefined;
    }

    return (
      worldState.ian.showNow &&
      (worldState.serverWantsNotificationTime || allStates.requestPhone.justAddedPhoneNumber)
    );
  },

  component: (worldState, resources, doAnticipateState) => (
    <RequestNotificationTime
      state={worldState}
      resources={resources}
      doAnticipateState={doAnticipateState}
    />
  ),
};
