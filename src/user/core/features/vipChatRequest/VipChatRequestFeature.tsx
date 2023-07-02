import { useCallback, useContext, useEffect } from 'react';
import { Feature } from '../../models/Feature';
import { VipChatRequestResources } from './VipChatRequestResources';
import { VipChatRequestState, VipChatRequest, convertVipChatRequest } from './VipChatRequestState';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { VipChatRequestComponent } from './VipChatRequestComponent';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';

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
    const chatRequest = useWritableValueWithCallbacks<{
      sub: string;
      request: VipChatRequest | null;
    } | null>(() => null);
    const lastSeenAt = useWritableValueWithCallbacks<Date | null>(() => null);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setLastSeenAt(null);
        return;
      }

      setLastSeenAt(getLastShownAt(loginContext.userAttributes.sub));

      function setLastSeenAt(v: Date | null) {
        if (v === lastSeenAt.get()) {
          return;
        }

        lastSeenAt.set(v);
        lastSeenAt.callbacks.call(undefined);
      }
    }, [loginContext, lastSeenAt]);

    useEffect(() => {
      let removeHandler: (() => void) | null = null;
      lastSeenAt.callbacks.add(handleLastSeenAtChanged);
      handleLastSeenAtChanged();
      return () => {
        if (removeHandler !== null) {
          removeHandler();
          removeHandler = null;
        }
        lastSeenAt.callbacks.remove(handleLastSeenAtChanged);
      };

      function handleLastSeenAtChanged() {
        if (removeHandler !== null) {
          removeHandler();
          removeHandler = null;
        }

        if (loginContext.state !== 'logged-in') {
          setChatRequest(null);
          return;
        }

        const sub = loginContext.userAttributes?.sub ?? null;
        if (sub === null) {
          setChatRequest(null);
          return;
        }

        const old = chatRequest.get();
        if (old !== null && old.sub === sub) {
          return;
        }

        removeHandler = handleLastSeenAt(lastSeenAt.get()) ?? null;
      }

      function handleLastSeenAt(lastSeenAt: Date | null): (() => void) | undefined {
        if (loginContext.state !== 'logged-in') {
          setChatRequest(null);
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
      }

      function setChatRequest(req: VipChatRequest | null) {
        const sub = loginContext.userAttributes?.sub ?? null;
        if (sub === null) {
          if (chatRequest.get() !== null) {
            chatRequest.set(null);
            chatRequest.callbacks.call(undefined);
          }
          return;
        }

        const old = chatRequest.get();
        if (old === null || old.sub !== sub || old.request !== req) {
          chatRequest.set({ sub, request: req });
          chatRequest.callbacks.call(undefined);
        }
      }
    }, [loginContext, lastSeenAt, chatRequest]);

    const onDoneRaw = useCallback(() => {
      if (loginContext.userAttributes?.sub) {
        const now = new Date();
        storeLastShownAt(loginContext.userAttributes.sub, now);
        lastSeenAt.set(now);
        lastSeenAt.callbacks.call(undefined);
        chatRequest.set({ sub: loginContext.userAttributes.sub, request: null });
        chatRequest.callbacks.call(undefined);
      }
    }, [loginContext.userAttributes?.sub, lastSeenAt, chatRequest]);
    const onDoneVWC = useReactManagedValueAsValueWithCallbacks(onDoneRaw);

    return useMappedValuesWithCallbacks(
      [chatRequest, onDoneVWC],
      (): VipChatRequestState => ({
        chatRequest: chatRequest.get()?.request ?? null,
        onDone: onDoneVWC.get(),
      })
    );
  },

  useResources(state, required) {
    const windowSize = useWindowSizeValueWithCallbacks({
      type: 'callbacks',
      props: () => state.get().forcedWindowSize,
      callbacks: state.callbacks,
    });
    const images = useOsehImageStateRequestHandler({});
    const image = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => ({
          uid: state.get().chatRequest?.variant?.image?.uid ?? null,
          jwt: state.get().chatRequest?.variant?.image?.jwt ?? null,
          displayWidth: 189,
          displayHeight: 189,
          alt: '',
        }),
        callbacks: state.callbacks,
      },
      images
    );
    const backgroundProps = useMappedValuesWithCallbacks([state, windowSize], () => ({
      uid: state.get().chatRequest?.variant?.backgroundImage?.uid ?? null,
      jwt: state.get().chatRequest?.variant?.backgroundImage?.jwt ?? null,
      displayWidth: windowSize.get().width,
      displayHeight: windowSize.get().height,
      alt: '',
    }));
    const background = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => backgroundProps.get(),
        callbacks: backgroundProps.callbacks,
      },
      images
    );

    return useMappedValuesWithCallbacks(
      [required, image, background, windowSize],
      (): VipChatRequestResources => ({
        loading: !required.get() || image.get().loading || background.get().loading,
        windowSize: windowSize.get(),
        variant: !required.get()
          ? null
          : {
              image: image.get(),
              background: background.get(),
            },
      })
    );
  },

  isRequired(state) {
    return state.chatRequest === undefined ? undefined : state.chatRequest !== null;
  },

  component(worldState, resources) {
    return <VipChatRequestComponent state={worldState} resources={resources} />;
  },
};
