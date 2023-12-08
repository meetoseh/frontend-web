import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../shared/ApiConstants';
import { LoginContext } from '../shared/contexts/LoginContext';
import { RenderGuardedComponent } from '../shared/components/RenderGuardedComponent';
import { useValueWithCallbacksEffect } from '../shared/hooks/useValueWithCallbacksEffect';

/**
 * Debug component for subscription status of the authorized user,
 * providing a button to subscribe if not subscribed
 */
export const AdminIsProSubscriber = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [proEntitlementState, setProEntitlementState] = useState<
    'loading' | 'active' | 'inactive' | 'failed'
  >('loading');
  const [queryParams, setQueryParams] = useState<URLSearchParams | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    setQueryParams(new URLSearchParams(window.location.search));
  }, []);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback((loginContext) => {
      let active = true;
      fetchProEntitlementState();
      return () => {
        active = false;
      };

      async function fetchProEntitlementState() {
        if (loginContext.state !== 'logged-in') {
          return;
        }

        const response = await apiFetch('/api/1/users/me/entitlements/pro', {}, loginContext);

        if (!active) {
          return;
        }

        if (!response.ok) {
          const text = await response.text();
          if (!active) {
            return;
          }
          console.log('failed to fetch pro entitlement state', text);
          setProEntitlementState('failed');
          return;
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        if (data.is_active) {
          setProEntitlementState('active');
        } else {
          setProEntitlementState('inactive');
        }
      }
    }, [])
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        let active = true;
        forceRefreshState();
        return () => {
          active = false;
        };

        async function forceRefreshState() {
          if (queryParams === null || queryParams.get('checkout_success') !== '1') {
            return;
          }
          if (proEntitlementState !== 'inactive') {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (!active) {
            return;
          }

          if (loginContextUnch.state !== 'logged-in') {
            return;
          }

          const checkoutUid = queryParams.get('checkout_uid');
          const finishResponse = await apiFetch(
            '/api/1/users/me/checkout/stripe/finish',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                checkout_uid: checkoutUid,
              }),
            },
            loginContextUnch
          );

          if (!active) {
            return;
          }

          if (!finishResponse.ok) {
            const text = await finishResponse.text();
            if (!active) {
              return;
            }

            console.warn('failed to finish checkout', text);
          }

          const response = await apiFetch(
            '/api/1/users/me/entitlements/pro',
            {
              headers: { Pragma: 'no-cache' },
            },
            loginContextUnch
          );

          if (!active) {
            return;
          }

          if (!response.ok) {
            const text = await response.text();
            if (!active) {
              return;
            }
            console.log('failed to fetch pro entitlement state', text);
            setProEntitlementState('failed');
            return;
          }

          const data = await response.json();
          if (!active) {
            return;
          }

          if (data.is_active) {
            setProEntitlementState('active');
          } else {
            setProEntitlementState('inactive');
          }
        }
      },
      [queryParams, proEntitlementState]
    )
  );

  const subscribe = useCallback(async () => {
    const loginContext = loginContextRaw.value.get();
    if (loginContext.state !== 'logged-in') {
      return;
    }

    setSubscribing(true);
    try {
      const response = await apiFetch(
        '/api/1/users/me/checkout/stripe/start',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            cancel_path: '/admin',
            success_path: '/admin',
          }),
        },
        loginContext
      );

      if (!response.ok) {
        const text = await response.text();
        console.log('failed to create checkout session', text);
        return;
      }

      const data = await response.json();
      window.location.href = data.url;
    } finally {
      setSubscribing(false);
    }
  }, [loginContextRaw]);

  return (
    <RenderGuardedComponent
      props={loginContextRaw.value}
      component={(loginContext) => (
        <>
          {(loginContext.state === 'logged-in' && (
            <>
              <div>Pro: {proEntitlementState}</div>
              {proEntitlementState === 'inactive' && (
                <button
                  type="button"
                  disabled={subscribing}
                  onClick={(e) => {
                    e.preventDefault();
                    subscribe();
                  }}>
                  Subscribe
                </button>
              )}
            </>
          )) || <div>Pro: not logged in</div>}
        </>
      )}
    />
  );
};
