import { useCallback, useContext } from 'react';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { Callbacks, useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { HavePro, MMRecurrence, ManageMembershipResources } from './ManageMembershipResources';
import { ManageMembershipState } from './ManageMembershipState';
import { setVWC } from '../../../../shared/lib/setVWC';
import { ManageMembership } from './ManageMembership';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';

export const ManageMembershipFeature: Feature<ManageMembershipState, ManageMembershipResources> = {
  identifier: 'manageMembership',
  useWorldState: () => {
    const showVWC = useWritableValueWithCallbacks(() => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      return path === '/settings/manage-membership';
    });

    const syncRequiredVWC = useWritableValueWithCallbacks((): boolean => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      const queryParams = url.searchParams;

      return path === '/settings/manage-membership' && queryParams.get('sync') !== null;
    });

    const loginContextRaw = useContext(LoginContext);
    useValuesWithCallbacksEffect(
      [syncRequiredVWC, loginContextRaw.value],
      useCallback(() => {
        if (!syncRequiredVWC.get()) {
          return;
        }

        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        const cancelers = new Callbacks<undefined>();
        performSync();
        return () => {
          active = false;
          cancelers.call(undefined);
        };

        async function performSyncInner(signal: AbortSignal | undefined) {
          if (!active) {
            return;
          }

          const response = await apiFetch(
            '/api/1/users/me/stripe/sync',
            {
              method: 'POST',
              signal,
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }
        }

        async function performSync() {
          const controller = window.AbortController ? new window.AbortController() : undefined;
          const signal = controller?.signal;
          const doAbort = () => controller?.abort();
          cancelers.add(doAbort);

          if (!active) {
            cancelers.remove(doAbort);
            return;
          }

          try {
            await performSyncInner(signal);
          } catch (e) {
            console.log('error requesting sync:', e);
          } finally {
            if (!active) {
              return;
            }

            const url = new URL(window.location.href);
            const path = url.pathname;
            const queryParams = url.searchParams;

            if (path === '/settings/manage-membership' && queryParams.get('sync') !== null) {
              queryParams.delete('sync');
              window.history.replaceState({}, '', url.toString());
            }
            setVWC(syncRequiredVWC, false);
          }
        }
      }, [syncRequiredVWC, loginContextRaw.value])
    );

    return useMappedValuesWithCallbacks(
      [showVWC, syncRequiredVWC],
      useCallback((): ManageMembershipState => {
        const show = showVWC.get();
        const loading = syncRequiredVWC.get() || showVWC.get() === undefined;
        return {
          show: loading ? undefined : show,
          setShow: (show, updateWindowHistory) => {
            if (loading) {
              throw new Error('Cannot call setShow while show is undefined');
            }

            setVWC(showVWC, show);
            if (updateWindowHistory) {
              if (show) {
                window.history.pushState({}, '', '/settings/manage-membership');
              } else {
                window.history.pushState({}, '', '/');
              }
            }
          },
        };
      }, [showVWC, syncRequiredVWC])
    );
  },
  isRequired(state) {
    return state.show;
  },
  useResources: (state, required, allStates) => {
    const loginContextRaw = useContext(LoginContext);
    const haveProVWC = useWritableValueWithCallbacks(
      (): HavePro => ({
        type: 'loading',
      })
    );

    useMappedValuesWithCallbacks(
      [loginContextRaw.value, required],
      useCallback(() => {
        if (!required.get()) {
          setVWC(haveProVWC, { type: 'loading' }, (a, b) => a.type === b.type);
          return undefined;
        }

        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state !== 'logged-in') {
          return undefined;
        }
        const loginContext = loginContextUnch;

        let active = true;
        const cancelers = new Callbacks<undefined>();
        fetchEntitlement();
        return () => {
          active = false;
          cancelers.call(undefined);
        };

        async function fetchEntitlementInner(
          signal: AbortSignal | undefined,
          force: boolean = true
        ) {
          if (!active) {
            return;
          }
          const response = await apiFetch(
            '/api/1/users/me/entitlements/pro',
            {
              method: 'GET',
              headers: force ? { Pragma: 'no-cache' } : {},
              signal,
            },
            loginContext
          );
          if (!active) {
            return;
          }

          if (!response.ok) {
            if (force && response.status === 429) {
              await fetchEntitlementInner(signal, false);
              return;
            }
            throw response;
          }

          const data:
            | {
                identifier: string;
                is_active: true;
                active_info: {
                  recurrence:
                    | { type: 'lifetime' }
                    | {
                        type: 'recurring';
                        period: { iso8601: string };
                        cycle_ends_at: number;
                        auto_renews: boolean;
                      };
                  platform: 'stripe' | 'ios' | 'google' | 'promotional';
                };
                expiration_date: number | null;
                checked_at: number;
              }
            | {
                identifier: string;
                is_active: false;
                active_info: null;
                expiration_date: number | null;
                checked_at: number;
              } = await response.json();
          if (!active) {
            return;
          }

          const parsedRecurrence: MMRecurrence | null =
            data.active_info === undefined || data.active_info === null
              ? null
              : data.active_info.recurrence.type === 'lifetime'
              ? { type: 'lifetime' }
              : {
                  type: 'recurring',
                  period: { iso8601: data.active_info.recurrence.period.iso8601 },
                  cycleEndsAt: new Date(data.active_info.recurrence.cycle_ends_at * 1000),
                  autoRenews: data.active_info.recurrence.auto_renews,
                };

          if (data.is_active && data.active_info.platform === 'stripe') {
            const response = await apiFetch(
              '/api/1/users/me/stripe/customer_portal',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ return_path: '/settings/manage-membership?sync=1' }),
                signal,
              },
              loginContext
            );
            if (!active) {
              return;
            }
            if (!response.ok) {
              throw response;
            }
            const portal: { url: string } = await response.json();
            if (!active) {
              return;
            }
            setVWC(haveProVWC, {
              type: 'loaded',
              value: true,
              platform: 'stripe',
              manageUrl: portal.url,
              recurrence: parsedRecurrence!,
            });
          } else if (data.is_active) {
            if (data.active_info.platform === 'stripe') {
              throw new Error('impossible state');
            }

            setVWC(haveProVWC, {
              type: 'loaded',
              value: true,
              platform: data.active_info.platform,
              recurrence: parsedRecurrence!,
            });
          } else {
            setVWC(haveProVWC, { type: 'loaded', value: false });
          }
        }

        async function fetchEntitlement() {
          const controller = window.AbortController ? new window.AbortController() : undefined;
          const signal = controller?.signal;
          const doAbort = () => controller?.abort();
          cancelers.add(doAbort);
          if (!active) {
            cancelers.remove(doAbort);
            return;
          }

          try {
            await fetchEntitlementInner(signal);
          } catch (e) {
            if (!active) {
              return;
            }
            const err = await describeError(e);
            if (!active) {
              return;
            }
            setVWC(haveProVWC, { type: 'error', error: err });
          } finally {
            cancelers.remove(doAbort);
          }
        }
      }, [loginContextRaw.value, required, haveProVWC])
    );

    return useMappedValuesWithCallbacks(
      [haveProVWC, required],
      useCallback((): ManageMembershipResources => {
        const havePro = haveProVWC.get();
        const req = required.get();
        return {
          loading: havePro.type === 'loading' || !req,
          havePro,
          gotoHome: () => {
            state.get().setShow(false, true);
          },
          gotoSeries: () => {
            allStates.get().favorites.setShow(true, true);
            state.get().setShow(false, false);
          },
          gotoSettings: () => {
            allStates.get().settings.setShow(true, true);
            state.get().setShow(false, false);
          },
          gotoUpgrade: () => {
            allStates.get().upgrade.setContext({ type: 'generic' }, true);
            state.get().setShow(false, false);
          },
        };
      }, [haveProVWC, required, allStates, state])
    );
  },
  component: (state, resources) => <ManageMembership state={state} resources={resources} />,
};
