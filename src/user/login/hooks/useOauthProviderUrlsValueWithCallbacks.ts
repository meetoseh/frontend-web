import { ReactElement, useCallback } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { ProvidersListItem } from '../components/ProvidersList';
import { OauthProvider } from '../lib/OauthProvider';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { getOauthProviderUrl } from '../lib/getOauthProviderUrl';
import { describeError } from '../../../shared/forms/ErrorBlock';

/**
 * Gets the urls for each of the specified providers, returning them in the same
 * order as provider list items.
 *
 * @param providers The providers to get the urls for
 * @returns [urls, error] the provider list item for each of the social login
 *   providers, in the same order. Set only if all the items are ready
 */
export const useOauthProviderUrlsValueWithCallbacks = (
  providers: ValueWithCallbacks<OauthProvider[]>
): [
  ValueWithCallbacks<Omit<ProvidersListItem, 'onLinkClick'>[]>,
  WritableValueWithCallbacks<ReactElement | null>
] => {
  const urls = useWritableValueWithCallbacks<Omit<ProvidersListItem, 'onLinkClick'>[]>(() => []);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  useValueWithCallbacksEffect(
    providers,
    useCallback(
      (providers) => {
        let running = true;
        getUrls();
        return () => {
          running = false;
        };

        async function getUrlsInner() {
          if (!running) {
            return;
          }

          if (providers.length === 0) {
            setVWC(urls, []);
            return;
          }

          const mapped = await Promise.all(providers.map(getOauthProviderUrl));

          if (!running) {
            return;
          }

          setVWC(
            urls,
            mapped.map((url, idx) => ({
              provider: providers[idx],
              onClick: url,
            }))
          );
        }

        async function getUrls() {
          try {
            await getUrlsInner();
          } catch (e) {
            const err = await describeError(e);
            if (!running) {
              return;
            }
            console.warn('error loading sign-in urls:', e);
            setVWC(error, err);
          }
        }
      },
      [urls, error]
    )
  );

  return [urls, error];
};
