import { ReactElement, useCallback, useContext } from 'react';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Feature } from '../../models/Feature';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { SettingsState } from './SettingsState';
import { SettingsResources } from './SettingsResources';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { Settings } from './Settings';

/**
 * Simple link page where the user can perform some key actions, like logging out.
 */
export const SettingsFeature: Feature<SettingsState, SettingsResources> = {
  identifier: 'settings',
  useWorldState: () => {
    const showVWC = useWritableValueWithCallbacks<boolean>(() => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      return path === '/settings';
    });
    const setShow = useCallback(
      (wants: boolean, updateWindowHistory: boolean) => {
        if (wants === showVWC.get()) {
          return;
        }

        if (wants) {
          setVWC(showVWC, true);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/settings`);
          }
        } else {
          setVWC(showVWC, false);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/`);
          }
        }
      },
      [showVWC]
    );

    return useMappedValuesWithCallbacks(
      [showVWC],
      (): SettingsState => ({
        show: showVWC.get(),
        setShow,
      })
    );
  },
  useResources: (stateVWC, requiredVWC) => {
    const loginContext = useContext(LoginContext);
    const haveProVWC = useWritableValueWithCallbacks<boolean | undefined>(() => undefined);
    const loadErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

    useValueWithCallbacksEffect(
      requiredVWC,
      useCallback(
        (required: boolean) => {
          if (!required || loginContext.state !== 'logged-in') {
            return undefined;
          }

          let active = true;
          fetchHavePro();
          return () => {
            active = false;
          };

          async function fetchHaveProInner() {
            let response = await apiFetch(
              '/api/1/users/me/entitlements/pro',
              {
                method: 'GET',
                headers: {
                  Pragma: 'no-cache',
                },
              },
              loginContext
            );
            if (!active) {
              return;
            }

            if (response.status === 429) {
              response = await apiFetch(
                '/api/1/users/me/entitlements/pro',
                {
                  method: 'GET',
                },
                loginContext
              );
              if (!active) {
                return;
              }
            }

            if (!response.ok) {
              throw response;
            }

            const data: { is_active: boolean } = await response.json();
            if (!active) {
              return;
            }

            setVWC(haveProVWC, data.is_active);
          }

          async function fetchHavePro() {
            try {
              await fetchHaveProInner();
            } catch (e) {
              const err = await describeError(e);
              if (active) {
                setVWC(loadErrorVWC, err);
              }
            }
          }
        },
        [loginContext, haveProVWC, loadErrorVWC]
      )
    );

    return useMappedValuesWithCallbacks([haveProVWC, loadErrorVWC], (): SettingsResources => {
      if (loadErrorVWC.get() !== null) {
        return {
          loading: false,
          havePro: undefined,
          loadError: loadErrorVWC.get(),
        };
      }

      return {
        loading: haveProVWC.get() === undefined,
        havePro: haveProVWC.get(),
        loadError: null,
      };
    });
  },
  isRequired: (state) => state.show,
  component: (state, resources) => <Settings state={state} resources={resources} />,
};
