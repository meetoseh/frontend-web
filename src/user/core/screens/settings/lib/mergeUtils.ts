import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { OauthProvider } from '../../../../login/lib/OauthProvider';

const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * Gets the URL that the user should be sent to in order to merge their account
 * with the one associated with the given provider.
 *
 * @param loginContext The login context, as these merge urls require authentication
 * @param provider The provider to merge with
 */
export const getMergeProviderUrl = async (
  loginContext: LoginContextValueLoggedIn,
  provider: OauthProvider
): Promise<string> => {
  if (isDevelopment && provider !== 'Direct') {
    return '/dev_login?merge=1';
  }

  if (!isDevelopment && provider === 'Dev') {
    // This shouldn't happen, but just in case we'll generate a real url
    provider = 'Direct';
  }

  const response = await apiFetch(
    '/api/1/oauth/prepare_for_merge',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ provider: provider }),
    },
    loginContext
  );

  if (!response.ok) {
    throw response;
  }

  const data = await response.json();
  return data.url;
};
