import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import { useTimezone } from '../../../../shared/hooks/useTimezone';

/**
 * Determines when we last showed the introspection prompt for the user with the
 * given sub on this device.
 */
const getLastShownAt = (sub: string): { response: string | null; at: Date } | null => {
  const storedValue = localStorage.getItem('notification-time-prompt');
  if (
    storedValue === undefined ||
    storedValue === null ||
    storedValue === '' ||
    storedValue[0] !== '{'
  ) {
    return null;
  }

  try {
    const parsed: { sub?: string; lastShownAt?: number; response?: string | null } =
      JSON.parse(storedValue);
    if (parsed.sub !== sub || parsed.lastShownAt === undefined || parsed.response === undefined) {
      return null;
    }
    return { response: parsed.response, at: new Date(parsed.lastShownAt) };
  } catch (e) {
    return null;
  }
};

/**
 * Stores that the given user saw the introspection prompt at the given time
 * @param sub The sub of the user
 * @param lastShownAt The time the user saw the screen
 * @param response The response the user gave
 */
const storeLastShownAt = (sub: string, lastShownAt: Date, response: string | null) => {
  localStorage.setItem(
    'notification-time-prompt',
    JSON.stringify({
      sub,
      lastShownAt: lastShownAt.getTime(),
      response,
    })
  );
};

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const RequestNotificationTimeStep: OnboardingStep<
  RequestNotificationTimeState,
  RequestNotificationTimeResources
> = {
  identifier: 'requestNotificationTime',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const [notificationTimeResponse, setNotificationTimeResponse] = useState<
      string | null | undefined
    >(undefined);
    const [serverWantsNotificationTime, setServerWantsNotificationTime] = useState<
      boolean | undefined
    >(undefined);
    const timezone = useTimezone();

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setNotificationTimeResponse(undefined);
        return;
      }

      const lastResponse = getLastShownAt(loginContext.userAttributes.sub);
      if (lastResponse === null) {
        setNotificationTimeResponse(undefined);
        return;
      }

      if (
        lastResponse.response === null &&
        lastResponse.at.getTime() + 24 * 60 * 60 * 1000 < Date.now()
      ) {
        setNotificationTimeResponse(undefined);
        return;
      }

      setNotificationTimeResponse(lastResponse.response);
    }, [loginContext]);

    useEffect(() => {
      if (notificationTimeResponse !== undefined) {
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
    }, [loginContext, notificationTimeResponse]);

    const onContinue = useCallback(
      (response: string | null): RequestNotificationTimeState => {
        if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
          return {
            sawNotificationTime: false,
            notificationTimeSelection: null,
            serverWantsNotificationTime: false,
            onContinue: () => {
              throw new Error('not available from onContinue');
            },
          };
        }

        storeLastShownAt(loginContext.userAttributes.sub, new Date(), response);
        setNotificationTimeResponse(response);
        setServerWantsNotificationTime(false);

        apiFetch(
          '/api/1/users/me/attributes/notification_time',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              notification_time: response?.toLowerCase() ?? 'any',
              timezone: timezone,
              timezone_technique: 'browser',
            }),
            keepalive: true,
          },
          loginContext
        );

        return {
          sawNotificationTime: true,
          serverWantsNotificationTime: false,
          notificationTimeSelection: response,
          onContinue: () => {
            throw new Error('onContinue should not be called from onContinue');
          },
        };
      },
      [loginContext, timezone]
    );

    return useMemo<RequestNotificationTimeState>(
      () => ({
        sawNotificationTime: notificationTimeResponse !== undefined,
        notificationTimeSelection: notificationTimeResponse,
        serverWantsNotificationTime,
        onContinue,
      }),
      [notificationTimeResponse, serverWantsNotificationTime, onContinue]
    );
  },
  useResources: (worldState, required) => {
    const loginContext = useContext(LoginContext);
    const givenName = loginContext.userAttributes?.givenName ?? null;
    const images = useOsehImageStatesRef({});
    const windowSize = useWindowSize();
    const [background, setBackground] = useState<OsehImageState | null>(null);
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
        givenName,
        background,
        prompt: prompt,
        loading: background === null || background.loading,
      }),
      [givenName, background, prompt]
    );
  },

  isRequired: (worldState, allStates) => {
    if (worldState.sawNotificationTime === undefined) {
      return undefined;
    }

    if (!worldState.sawNotificationTime && worldState.serverWantsNotificationTime === undefined) {
      return undefined;
    }

    return (
      !worldState.sawNotificationTime &&
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
