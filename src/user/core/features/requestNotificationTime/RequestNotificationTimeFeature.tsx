import { useContext, useEffect } from 'react';
import { Feature } from '../../models/Feature';
import {
  LoginContext,
  LoginContextValueLoggedIn,
  LoginContextValueUnion,
} from '../../../../shared/contexts/LoginContext';
import { Channel, RequestNotificationTimeState } from './RequestNotificationTimeState';
import {
  ChannelSettings,
  RequestNotificationTimeResources,
} from './RequestNotificationTimeResources';
import { apiFetch } from '../../../../shared/ApiConstants';
import { RequestNotificationTime } from './RequestNotificationTime';
import {
  InappNotification,
  useInappNotificationValueWithCallbacks,
} from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { DayOfWeek } from '../../../../shared/models/DayOfWeek';

export const RequestNotificationTimeFeature: Feature<
  RequestNotificationTimeState,
  RequestNotificationTimeResources
> = {
  identifier: 'requestNotificationTime',
  useWorldState: () => {
    const loginContextRaw = useContext(LoginContext);
    const missingPhone = useMappedValueWithCallbacks(loginContextRaw.value, (loginContextUnch) => {
      if (loginContextUnch.state !== 'logged-in') {
        return undefined;
      }

      return (
        loginContextUnch.userAttributes === null ||
        loginContextUnch.userAttributes.phoneNumber === null
      );
    });

    const ian = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({
        uid: 'oseh_ian_n-1kL6iJ76lhSgxLSAPJrQ',
        suppress: missingPhone.get() ?? true,
      }),
      callbacks: missingPhone.callbacks,
    });
    const serverWantsNotificationTime = useWritableValueWithCallbacks<Channel[] | null | undefined>(
      () => undefined
    );

    useEffect(() => {
      let cleanup: (() => void) | null = null;
      ian.callbacks.add(handleChanged);
      loginContextRaw.value.callbacks.add(handleChanged);
      return () => {
        ian.callbacks.remove(handleChanged);
        loginContextRaw.value.callbacks.remove(handleChanged);
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
      };

      function handle(
        ian: InappNotification | null,
        loginContextUnch: LoginContextValueUnion
      ): (() => void) | undefined {
        if (ian === null || !ian.showNow) {
          setServerWantsNotificationTime(undefined);
          return;
        }

        if (loginContextUnch.state !== 'logged-in') {
          setServerWantsNotificationTime(undefined);
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        askServer();
        return () => {
          active = false;
        };

        async function askServer() {
          try {
            const channels = await askServerInner(loginContext);
            if (active) {
              setServerWantsNotificationTime(
                channels.wantsNotificationTimePrompt ? channels.channels : null
              );
            }
          } catch (e) {
            if (active) {
              console.error(
                'Server did not respond to wants_notification_time_prompt request: ',
                e
              );
              setServerWantsNotificationTime(null);
            }
            return;
          }
        }
      }

      function handleChanged() {
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }

        cleanup = handle(ian.get(), loginContextRaw.value.get()) ?? null;
      }

      function setServerWantsNotificationTime(v: Channel[] | null | undefined) {
        setVWC(serverWantsNotificationTime, v, (a, b) => {
          if (a === b) {
            return true;
          }

          if (a === null || b === null || a === undefined || b === undefined) {
            return false;
          }

          if (a.length !== b.length) {
            return false;
          }

          const sortedA = [...a].sort();
          const sortedB = [...b].sort();
          for (let i = 0; i < sortedA.length; i++) {
            if (sortedA[i] !== sortedB[i]) {
              return false;
            }
          }

          return true;
        });
      }
    }, [loginContextRaw, ian, serverWantsNotificationTime]);

    const clientRequested = useWritableValueWithCallbacks(() => false);

    return useMappedValuesWithCallbacks(
      [ian, missingPhone, serverWantsNotificationTime, clientRequested],
      (): RequestNotificationTimeState => ({
        ian: ian.get(),
        missingPhone: missingPhone.get(),
        serverWantsNotificationTime: serverWantsNotificationTime.get(),
        clientRequested: clientRequested.get(),
        setClientRequested: (v) => {
          setVWC(clientRequested, v);
        },
      })
    );
  },

  useResources: (stateVWC, requiredVWC) => {
    const loginContextRaw = useContext(LoginContext);
    const session = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: stateVWC.get().ian?.uid ?? null }),
      callbacks: stateVWC.callbacks,
    });

    const channelsVWC = useWritableValueWithCallbacks<Channel[] | undefined>(() => undefined);
    const currentSettingsVWC = useWritableValueWithCallbacks<Record<
      Channel,
      ChannelSettings
    > | null>(() => null);

    useValuesWithCallbacksEffect([requiredVWC, loginContextRaw.value], () => {
      const req = requiredVWC.get();
      const loginContextUnch = loginContextRaw.value.get();
      if (!req) {
        setVWC(currentSettingsVWC, null);
        return undefined;
      }

      if (loginContextUnch.state !== 'logged-in') {
        setVWC(currentSettingsVWC, null);
        return undefined;
      }
      const loginContext = loginContextUnch;

      let active = true;
      fetchSettings();
      return () => {
        active = false;
      };

      async function fetchSettingsInner() {
        const response = await apiFetch(
          '/api/1/users/me/daily_reminder_settings',
          {
            method: 'GET',
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: Record<
          Channel,
          Omit<ChannelSettings, 'days' | 'isReal'> & { days: DayOfWeek[]; is_real: boolean }
        > = await response.json();

        const currentSettings = {} as { [k: string]: ChannelSettings };
        for (const [k, v] of Object.entries(data)) {
          currentSettings[k] = {
            start: v.start,
            end: v.end,
            days: new Set<DayOfWeek>(v.days),
            isReal: v.is_real ?? false,
          };
        }

        if (active) {
          setVWC(currentSettingsVWC, currentSettings as Record<Channel, ChannelSettings>);
        }
      }

      async function fetchSettings() {
        try {
          await fetchSettingsInner();
        } catch (e) {
          if (active) {
            console.log('Failed to fetch current settings, treating as empty:', e);
            setVWC(currentSettingsVWC, {
              email: makeDefaultSettings(),
              push: makeDefaultSettings(),
              sms: makeDefaultSettings(),
            });
          }
        }
      }

      function makeDefaultSettings(): ChannelSettings {
        return {
          days: new Set<DayOfWeek>([
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ]),
          start: 8 * 3600,
          end: 10 * 3600,
          isReal: false,
        };
      }
    });

    useValuesWithCallbacksEffect(
      [stateVWC, requiredVWC, channelsVWC, loginContextRaw.value],
      () => {
        if (channelsVWC.get() !== undefined) {
          return;
        }

        if (!requiredVWC.get()) {
          setVWC(channelsVWC, undefined);
          return;
        }

        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state !== 'logged-in') {
          setVWC(channelsVWC, undefined);
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        getLatestServerChannels();
        return () => {
          active = false;
        };

        async function getLatestServerChannels() {
          try {
            const resp = await askServerInner(loginContext);
            if (!active) {
              return;
            }

            if (
              !stateVWC.get().clientRequested &&
              resp.wantsNotificationTimePrompt &&
              resp.channels !== null
            ) {
              setVWC(channelsVWC, resp.channels);
              return;
            }
            setVWC(channelsVWC, resp.potentialChannels);
          } catch (e) {
            if (active) {
              console.error('Could not update server channels: ', e);
              const allChannels: Channel[] = ['email', 'sms', 'push'];
              setVWC(channelsVWC, allChannels);
            }
            return;
          }
        }
      }
    );

    return useMappedValuesWithCallbacks(
      [channelsVWC, session, currentSettingsVWC, loginContextRaw.value],
      () => {
        const channels = channelsVWC.get();
        const currentSettings = currentSettingsVWC.get();
        const channelsCp: Channel[] = channels !== undefined ? [...channels] : [];
        const preferredChannelsOrder: Channel[] = ['push', 'sms', 'email'];
        channelsCp.sort((a, b) => {
          const aIdx = preferredChannelsOrder.indexOf(a);
          const bIdx = preferredChannelsOrder.indexOf(b);

          if (aIdx === bIdx) {
            return 0;
          }

          if (aIdx < 0) {
            return 1;
          }

          if (bIdx < 0) {
            return -1;
          }

          return aIdx - bIdx;
        });

        const loginContextUnch = loginContextRaw.value.get();

        return {
          session: session.get(),
          loading:
            loginContextUnch.state === 'loading' ||
            currentSettings === null ||
            channels === undefined,
          currentSettings,
          setCurrentSettings:
            currentSettings === null
              ? () => {
                  throw new Error('not initialized');
                }
              : (newSettings) => {
                  setVWC(currentSettingsVWC, newSettings);
                },
          channels: channelsCp,
        };
      }
    );
  },

  isRequired: (worldState, allStates) => {
    if (worldState.clientRequested) {
      return true;
    }

    if (allStates.homeScreen.sessionInfo.classesTaken < 1) {
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
      (worldState.serverWantsNotificationTime !== null ||
        allStates.requestPhone.justAddedPhoneNumber)
    );
  },

  component: (worldState, resources) => (
    <RequestNotificationTime state={worldState} resources={resources} />
  ),
};

async function askServerInner(loginContext: LoginContextValueLoggedIn): Promise<{
  wantsNotificationTimePrompt: boolean;
  channels: Channel[];
  potentialChannels: Channel[];
}> {
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

  const data: {
    wants_notification_time_prompt: boolean;
    channels: Channel[];
    potential_channels: Channel[];
  } = await response.json();

  return {
    wantsNotificationTimePrompt: data.wants_notification_time_prompt,
    channels: data.channels,
    potentialChannels: data.potential_channels,
  };
}
