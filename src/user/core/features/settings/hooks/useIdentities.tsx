import { ReactElement, useCallback, useContext } from 'react';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { MergeProvider } from '../../mergeAccount/MergeAccountState';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { describeError } from '../../../../../shared/forms/ErrorBlock';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';

export type Identity = {
  /**
   * The UID that Oseh assigned to this identity, which is stable but
   * does not persist through account deletion
   */
  uid: string;

  /**
   * The provider this identity is connected through
   */
  provider: MergeProvider;

  /**
   * The email address associated with the identity, if there is one
   */
  email: string | null;
};

export type IdentitiesSuccess = {
  type: 'success';
  identities: Identity[];
};

export type IdentitiesLoading = {
  type: 'loading';
};

export type IdentitiesUnavailable = {
  type: 'unavailable';
  reason: 'not-logged-in';
};

export type IdentitiesError = {
  type: 'error';
  error: ReactElement;
};

export type IdentitiesState =
  | IdentitiesSuccess
  | IdentitiesLoading
  | IdentitiesUnavailable
  | IdentitiesError;

const areIdentityStatesEqual = (a: IdentitiesState, b: IdentitiesState): boolean => {
  if (a.type !== b.type) {
    return false;
  }
  switch (a.type) {
    case 'error':
      return Object.is(a.error, (b as IdentitiesError).error);
    case 'loading':
      return true;
    case 'success':
      return Object.is(a.identities, (b as IdentitiesSuccess).identities);
    case 'unavailable':
      return a.reason === (b as IdentitiesUnavailable).reason;
  }
  return false;
};

/**
 * Loads all of the identities associated with a user
 *
 * @param suppressed If true, the identities will not be loaded
 */
export const useIdentities = (
  suppressedVWC: ValueWithCallbacks<boolean>
): ValueWithCallbacks<IdentitiesState> => {
  const loginContext = useContext(LoginContext);
  const result = useWritableValueWithCallbacks<IdentitiesState>(() => ({ type: 'loading' }));

  useValueWithCallbacksEffect(
    suppressedVWC,
    useCallback(
      (suppressed) => {
        if (suppressed) {
          setVWC(result, { type: 'loading' }, areIdentityStatesEqual);
          return;
        }

        let running = true;
        loadIdentities();
        return () => {
          running = false;
        };

        async function loadIdentitiesInner() {
          const response = await apiFetch(
            '/api/1/users/me/search_identities',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                limit: 1000,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const raw: { items: Identity[] } = await response.json();
          if (running) {
            setVWC(
              result,
              {
                type: 'success',
                identities: raw.items,
              },
              () => false
            );
          }
        }

        async function loadIdentities() {
          if (loginContext.state === 'loading') {
            setVWC(result, { type: 'loading' }, areIdentityStatesEqual);
            return;
          }

          if (loginContext.state === 'logged-out') {
            setVWC(
              result,
              { type: 'unavailable', reason: 'not-logged-in' },
              areIdentityStatesEqual
            );
            return;
          }

          try {
            await loadIdentitiesInner();
          } catch (e) {
            const err = await describeError(e);
            if (running) {
              setVWC(result, { type: 'error', error: err }, () => false);
            }
          }
        }
      },
      [loginContext, result]
    )
  );

  return result;
};
