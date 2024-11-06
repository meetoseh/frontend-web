import { HTTP_API_URL } from '../../../shared/ApiConstants';
import { chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

/**
 * Switches urls to go to the /dev_login page instead of the hosted ui
 */
const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * Gets the url for the given social login provider.
 */
export const getOauthProviderUrl = async (provider: string): Promise<string> => {
  if (isDevelopment && provider !== 'Direct') {
    return '/dev_login';
  }

  const isYoutubeAccount =
    provider === 'Google' && localStorage.getItem('youtubeAccount') === 'true';

  let response;
  try {
    response = await fetch(HTTP_API_URL + '/api/1/oauth/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        provider: provider,
        refresh_token_desired: true,
        ...(isYoutubeAccount
          ? {
              is_youtube_account: true,
            }
          : {}),
      }),
    });
  } catch {
    throw new DisplayableError('connectivity', `prepare ${provider}`);
  }

  if (!response.ok) {
    throw chooseErrorFromStatus(response.status, `prepare ${provider}`);
  }

  try {
    const data = await response.json();
    return data.url;
  } catch {
    throw new DisplayableError('connectivity', `prepare ${provider}`);
  }
};
