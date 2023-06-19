import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Feature } from '../../models/Feature';
import { VipChatRequestResources } from './VipChatRequestResources';
import { VipChatRequestState, VipChatRequest, convertVipChatRequest } from './VipChatRequestState';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/LoginContext';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { VipChatRequestComponent } from './VipChatRequestComponent';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';

/**
 * Determines when we last showed the vip chat request for the user with the
 * given sub on this device.
 */
const getLastShownAt = (sub: string): Date | null => {
  const storedValue = localStorage.getItem('vip-chat-request');
  if (
    storedValue === undefined ||
    storedValue === null ||
    storedValue === '' ||
    storedValue[0] !== '{'
  ) {
    return null;
  }

  try {
    const parsed: { sub?: string; lastShownAt?: number } = JSON.parse(storedValue);
    if (parsed.sub !== sub || parsed.lastShownAt === undefined) {
      return null;
    }
    return new Date(parsed.lastShownAt);
  } catch (e) {
    return null;
  }
};

/**
 * Stores that the given user saw the vip chat request at the given time
 * @param sub The sub of the user
 * @param lastShownAt The time the user saw the screen
 */
const storeLastShownAt = (sub: string, lastShownAt: Date) => {
  localStorage.setItem(
    'vip-chat-request',
    JSON.stringify({
      sub,
      lastShownAt: lastShownAt.getTime(),
    })
  );
};

/**
 * The step where an admin user specifically wants to reach out
 * to this user to chat with them. They see this prompt the next
 * time they open the website/app, and can contact the admin
 * through the prompt.
 */
export const VipChatRequestFeature: Feature<VipChatRequestState, VipChatRequestResources> = {
  identifier: 'vipChatRequest',

  useWorldState() {
    const loginContext = useContext(LoginContext);
    const [chatRequest, setChatRequest] = useState<VipChatRequest | null | undefined>(undefined);
    const [lastSeenAt, setLastSeenAt] = useState<Date | null>(null);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setLastSeenAt(null);
        return;
      }

      setLastSeenAt(getLastShownAt(loginContext.userAttributes.sub));
    }, [loginContext]);

    useEffect(() => {
      if (loginContext.state !== 'logged-in') {
        setChatRequest(undefined);
        return;
      }

      if (
        lastSeenAt !== null &&
        lastSeenAt.getTime() + 1000 * 60 * 60 * 24 * 3 > new Date().getTime()
      ) {
        setChatRequest(null);
        return;
      }

      let active = true;
      fetchChatRequest();
      return () => {
        active = false;
      };

      async function fetchChatRequestInner(): Promise<VipChatRequest | null> {
        const response = await apiFetch(
          '/api/1/vip_chat_requests/mine',
          {
            method: 'GET',
          },
          loginContext
        );

        if (response.status === 204) {
          return null;
        }

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        return convertVipChatRequest(data);
      }

      async function fetchChatRequest() {
        try {
          const req = await fetchChatRequestInner();
          if (active) {
            setChatRequest(req);
          }
        } catch (e) {
          if (active) {
            console.error('error fetching vip chat request', e);
            setChatRequest(null);
          }
        }
      }
    }, [loginContext, lastSeenAt]);

    const onDone = useCallback(() => {
      if (loginContext.userAttributes?.sub) {
        const now = new Date();
        storeLastShownAt(loginContext.userAttributes.sub, now);
        setLastSeenAt(now);
      }
      setChatRequest(null);
      return {
        chatRequest: null,
        onDone: () => {
          throw new Error('onDone called twice');
        },
      };
    }, [loginContext.userAttributes?.sub]);

    return useMemo(
      () => ({
        chatRequest,
        onDone,
      }),
      [chatRequest, onDone]
    );
  },

  useResources(state, required) {
    const windowSize = useWindowSize(state.forcedWindowSize);
    const images = useOsehImageStateRequestHandler({});
    const image = useOsehImageState(
      {
        uid: state.chatRequest?.variant?.image?.uid ?? null,
        jwt: state.chatRequest?.variant?.image?.jwt ?? null,
        displayWidth: 189,
        displayHeight: 189,
        alt: '',
      },
      images
    );
    const background = useOsehImageState(
      {
        uid: state.chatRequest?.variant?.backgroundImage?.uid ?? null,
        jwt: state.chatRequest?.variant?.backgroundImage?.jwt ?? null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
      },
      images
    );
    return useMemo(
      () => ({
        loading: !required || image.loading || background.loading,
        windowSize,
        variant: !required
          ? null
          : {
              image,
              background,
            },
      }),
      [required, image, background, windowSize]
    );
  },

  isRequired(state) {
    return state.chatRequest === undefined ? undefined : state.chatRequest !== null;
  },

  component(worldState, resources, doAnticipateState) {
    return (
      <VipChatRequestComponent
        state={worldState}
        resources={resources}
        doAnticipateState={doAnticipateState}
      />
    );
  },
};
