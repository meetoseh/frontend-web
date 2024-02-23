import { useCallback, useContext } from 'react';
import { Callbacks, ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { ExternalCourse, externalCourseKeyMap } from '../lib/ExternalCourse';
import {
  ForegroundChangedIdentifier,
  LoginContext,
  addForegroundChangedListener,
  canCheckForegrounded,
  isForegrounded,
  removeForegroundChangedListener,
} from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { getJwtExpiration } from '../../../shared/lib/getJwtExpiration';
import { getCurrentServerTimeMS } from '../../../shared/lib/getCurrentServerTimeMS';

/**
 * Refreshes the given item from the search_public endpoint if any of the jwts
 * expire
 *
 * @param item The item to refresh. Can either be strictly present or null/undefinable;
 *   when null or undefined, the item will not be refreshed
 * @param setItem The callback to update the item
 * @param category The category to search in
 */
export const useRefreshedExternalCourse = (
  item: ValueWithCallbacks<ExternalCourse> | ValueWithCallbacks<ExternalCourse | null | undefined>,
  setItem: (newItem: ExternalCourse) => void,
  category: 'list' | 'library'
): void => {
  const loginContextRaw = useContext(LoginContext);

  const refreshItem = useCallback(
    async (signal?: AbortSignal | undefined) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('cannot refresh when not logged in');
      }
      const loginContext = loginContextUnch;
      const uid = item.get()?.uid;
      if (uid === undefined) {
        throw new Error('cannot refresh when uid is undefined');
      }

      signal?.throwIfAborted();
      const response = await apiFetch(
        '/api/1/courses/search_public?category=' + category,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              uid: {
                operator: 'eq',
                value: uid,
              },
            },
            limit: 1,
          }),
          signal,
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const raw: { items: any[] } = await response.json();
      if (raw.items.length !== 1) {
        throw new Error('unexpected response');
      }

      const parsed = await convertUsingMapper(raw.items[0], externalCourseKeyMap);
      setItem(parsed);
    },
    [item, setItem, loginContextRaw, category]
  );

  useValuesWithCallbacksEffect([loginContextRaw.value, item], () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;
    const loginJwtExpiresAt = getJwtExpiration(loginContext.authTokens.idToken);

    const itm = item.get();
    if (itm === null || itm === undefined) {
      return;
    }

    const jwts: string[] = [
      itm.backgroundImage.jwt,
      itm.introVideo?.jwt,
      itm.introVideoThumbnail?.jwt,
      itm.introVideoTranscript?.jwt,
      itm.logo?.jwt,
    ].filter((v) => v !== undefined && v !== null) as string[];
    const expiries = jwts.map((jwt) => getJwtExpiration(jwt));
    const minExpiry = Math.min(...expiries);

    let timeout: NodeJS.Timeout | undefined = undefined;
    let visibilityIden: ForegroundChangedIdentifier | undefined = undefined;
    const cancelers = new Callbacks<undefined>();
    let active = true;
    registerVisibilityHandler();
    onTimeout();

    return () => {
      active = false;
      if (timeout !== undefined) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      if (visibilityIden !== undefined) {
        removeForegroundChangedListener(visibilityIden);
      }
      cancelers.call(undefined);
    };

    async function onTimeout() {
      timeout = undefined;
      if (!active) {
        return;
      }

      const nowServer = await getCurrentServerTimeMS();
      if (!active) {
        return;
      }

      if (loginJwtExpiresAt <= nowServer + 1000) {
        // request will fail anyway; wait for automatical login token refresh
        return;
      }

      const timeUntilNextExpiry = minExpiry - nowServer;
      if (timeUntilNextExpiry >= 35000) {
        timeout = setTimeout(onTimeout, timeUntilNextExpiry - 30000);
        return;
      }

      if ((await canCheckForegrounded()) && !(await isForegrounded())) {
        if (active) {
          timeout = setTimeout(onTimeout, 10000);
        }
        return;
      }
      if (!active) {
        return;
      }

      const controller = window.AbortController ? new AbortController() : undefined;
      const signal = controller?.signal;
      const doAbort = () => controller?.abort();
      cancelers.add(doAbort);

      try {
        await refreshItem(signal);
      } catch (e) {
        console.log('failed to refresh item:', e);
      } finally {
        cancelers.remove(doAbort);
      }
    }

    function onVisibilityChange() {
      if (timeout !== undefined) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      onTimeout();
    }

    async function registerVisibilityHandler() {
      const canCheck = await canCheckForegrounded();
      if (!active || !canCheck || visibilityIden !== undefined) {
        return;
      }

      const iden = await addForegroundChangedListener(onVisibilityChange);
      if (!active) {
        removeForegroundChangedListener(iden);
      } else {
        if (visibilityIden !== undefined) {
          removeForegroundChangedListener(visibilityIden);
        }

        visibilityIden = iden;
      }
    }
  });
};
