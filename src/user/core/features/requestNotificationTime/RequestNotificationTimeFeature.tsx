import { useContext, useEffect } from 'react';
import { Feature } from '../../models/Feature';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import {
  PublicInteractivePrompt,
  usePublicInteractivePrompt,
} from '../../../../shared/hooks/usePublicInteractivePrompt';
import { RequestNotificationTimeState } from './RequestNotificationTimeState';
import { RequestNotificationTimeResources } from './RequestNotificationTimeResources';
import { apiFetch } from '../../../../shared/ApiConstants';
import { RequestNotificationTime } from './RequestNotificationTime';
import {
  InappNotification,
  useInappNotificationValueWithCallbacks,
} from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../../../shared/images/useStaleOsehImageOnSwap';

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const RequestNotificationTimeFeature: Feature<
  RequestNotificationTimeState,
  RequestNotificationTimeResources
> = {
  identifier: 'requestNotificationTime',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const missingPhone = useReactManagedValueAsValueWithCallbacks(
      loginContext.state === 'loading'
        ? undefined
        : loginContext.state !== 'logged-in' ||
            loginContext.userAttributes === null ||
            loginContext.userAttributes.phoneNumber === null
    );

    const ian = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({
        uid: 'oseh_ian_aJs054IZzMnJE2ulbbyT6w',
        suppress: missingPhone.get() ?? true,
      }),
      callbacks: missingPhone.callbacks,
    });
    const serverWantsNotificationTime = useWritableValueWithCallbacks<boolean | undefined>(
      () => undefined
    );

    useEffect(() => {
      let cleanup: (() => void) | null = null;
      ian.callbacks.add(handleIANChanged);
      return () => {
        ian.callbacks.remove(handleIANChanged);
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
      };

      function handleIAN(ian: InappNotification | null): (() => void) | undefined {
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
              console.error(
                'Server did not respond to wants_notification_time_prompt request: ',
                e
              );
              setServerWantsNotificationTime(false);
            }
            return;
          }
        }
      }

      function handleIANChanged() {
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }

        cleanup = handleIAN(ian.get()) ?? null;
      }

      function setServerWantsNotificationTime(v: boolean | undefined) {
        if (v === serverWantsNotificationTime.get()) {
          return;
        }

        serverWantsNotificationTime.set(v);
        serverWantsNotificationTime.callbacks.call(undefined);
      }
    }, [loginContext, ian, serverWantsNotificationTime]);

    return useMappedValuesWithCallbacks(
      [ian, missingPhone, serverWantsNotificationTime],
      (): RequestNotificationTimeState => ({
        ian: ian.get(),
        missingPhone: missingPhone.get(),
        serverWantsNotificationTime: serverWantsNotificationTime.get(),
      })
    );
  },

  useResources: (stateVWC, requiredVWC) => {
    const loginContext = useContext(LoginContext);
    const givenNameRaw = loginContext.userAttributes?.givenName ?? null;
    const givenNameVWC = useReactManagedValueAsValueWithCallbacks(givenNameRaw);
    const images = useOsehImageStateRequestHandler({});
    const windowSizeVWC = useWindowSizeValueWithCallbacks();
    const session = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: stateVWC.get().ian?.uid ?? null }),
      callbacks: stateVWC.callbacks,
    });
    const interestsRaw = useContext(InterestsContext);
    const interestsVWC = useReactManagedValueAsValueWithCallbacks(interestsRaw);

    const promptVWC = usePublicInteractivePrompt({
      type: 'callbacks',
      props: () => ({
        identifier: 'notification-time',
        load: requiredVWC.get(),
      }),
      callbacks: requiredVWC.callbacks,
    });
    const backgroundPropsVWC = useMappedValuesWithCallbacks(
      [requiredVWC, windowSizeVWC],
      (): OsehImageProps => ({
        uid: requiredVWC.get() ? backgroundImageUid : null,
        jwt: null,
        displayWidth: windowSizeVWC.get().width,
        displayHeight: windowSizeVWC.get().height,
        alt: '',
        isPublic: true,
      })
    );
    const backgroundVWC = useStaleOsehImageOnSwap(
      useOsehImageStateValueWithCallbacks(
        {
          type: 'callbacks',
          props: () => backgroundPropsVWC.get(),
          callbacks: backgroundPropsVWC.callbacks,
        },
        images
      )
    );
    const personalizedPromptVWC = useMappedValuesWithCallbacks(
      [interestsVWC, promptVWC],
      (): PublicInteractivePrompt => {
        const interests = interestsVWC.get();
        const prompt = promptVWC.get();
        if (interests.state !== 'loaded' || prompt.loading || prompt.prompt === null) {
          return prompt;
        }

        if (interests.primaryInterest === 'sleep') {
          // the type checker can't handle this case :/
          return {
            ...prompt,
            prompt: {
              ...prompt.prompt,
              prompt: {
                ...prompt.prompt.prompt,
                text: 'Staying relaxed during the day will help you sleep at night. When do you want to be reminded to relax?',
              },
            },
          } as any;
        }

        return prompt;
      }
    );

    return useMappedValuesWithCallbacks(
      [session, givenNameVWC, backgroundVWC, personalizedPromptVWC, interestsVWC],
      () => ({
        session: session.get(),
        givenName: givenNameVWC.get(),
        background: backgroundVWC.get(),
        prompt: personalizedPromptVWC.get(),
        loading: backgroundVWC.get().loading || interestsVWC.get().state === 'loading',
      })
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

  component: (worldState, resources) => (
    <RequestNotificationTime state={worldState} resources={resources} />
  ),
};
