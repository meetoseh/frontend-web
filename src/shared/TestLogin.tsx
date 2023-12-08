import './TestLogin.css';
import {
  ChangeEvent,
  FormEvent,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { HTTP_API_URL, apiFetch } from './ApiConstants';
import { InterestsContext } from './contexts/InterestsContext';
import { LoginContext } from './contexts/LoginContext';
import { useWritableValueWithCallbacks } from './lib/Callbacks';
import { setVWC } from './lib/setVWC';
import { RenderGuardedComponent } from './components/RenderGuardedComponent';

/**
 * Shows a development page where you can login just be specifying your user
 * sub. Only works in the dev environment when targeting a local server.
 *
 * Should be within an interests provider for similarity to the regular
 * login flow.
 */
export const TestLogin = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [loggingIn, setLoggingIn] = useState(false);
  const [userSub, setUserSub] = useState('timothy');
  const interests = useContext(InterestsContext);
  const [isMerge, setIsMerge] = useState<boolean | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string>(
    process.env.REACT_APP_ROOT_FRONTEND_URL || window.location.origin
  );
  const [overrideIdToken, setOverrideIdToken] = useState<string | null>(null);
  const log = useWritableValueWithCallbacks<string>(() => '');

  useEffect(() => {
    if (isMerge !== null) {
      return;
    }

    const queryParams = window.location.search;
    if (queryParams === '') {
      setIsMerge(false);
      return;
    }
    let args: URLSearchParams;
    try {
      args = new URLSearchParams(queryParams.substring(1));
    } catch {
      setIsMerge(false);
      return;
    }

    setIsMerge(args.get('merge') === '1');

    if (args.has('redirect_url')) {
      const requestedUrl = args.get('redirect_url') || '';
      if (requestedUrl === 'oseh://login_callback') {
        setRedirectUrl(requestedUrl);
      }
    }

    if (args.has('id_token')) {
      setOverrideIdToken(args.get('id_token') || null);
    }
  }, [isMerge]);

  const login = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setLoggingIn(true);
      try {
        const response = await apiFetch(
          '/api/1/dev/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              sub: userSub,
              refresh_token_desired: true,
            }),
          },
          null
        );

        if (!response.ok) {
          throw response;
        }

        const data: { id_token: string; refresh_token: string; onboard: boolean } =
          await response.json();
        window.location.href =
          '/#' +
          new URLSearchParams({
            id_token: data.id_token,
            refresh_token: data.refresh_token,
            ...(data.onboard ? { onboard: '1' } : {}),
          }).toString();
      } catch (e) {
        console.error(e);
        setLoggingIn(false);
      }
    },
    [userSub]
  );

  const merge = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setVWC(log, log.get() + 'merge called\n');

      setLoggingIn(true);
      const idToken =
        overrideIdToken !== null
          ? overrideIdToken
          : ((c) => {
              if (c.state !== 'logged-in') {
                return undefined;
              }
              return c.authTokens.idToken;
            })(loginContextRaw.value.get());
      try {
        const response = await fetch(HTTP_API_URL + '/api/1/dev/merge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `bearer ${idToken}`,
          },
          body: JSON.stringify({
            sub: userSub,
          }),
        });

        if (!response.ok) {
          setVWC(log, log.get() + `merge failed with response: ${response.status}\n`);
          throw response;
        }

        const data: { merge_token: string } = await response.json();
        setVWC(log, log.get() + `merge succeeded\n`);
        const redirectUri =
          redirectUrl +
          '/#' +
          new URLSearchParams({
            merge_token: data.merge_token,
          }).toString();
        setVWC(log, log.get() + `redirecting to ${redirectUri}\n`);
        document.location.assign(redirectUri);
      } catch (e) {
        console.error(e);
        setLoggingIn(false);
      }
    },
    [loginContextRaw, userSub, redirectUrl, log, overrideIdToken]
  );

  return (
    <div className="TestLogin">
      <h1>{isMerge ? 'Merge' : 'Login'}</h1>
      <form onSubmit={isMerge ? merge : login}>
        <label htmlFor="userSub">User Sub</label>
        <input
          type="text"
          id="userSub"
          name="userSub"
          value={userSub}
          onChange={useCallback((e: ChangeEvent<HTMLInputElement>) => {
            if (e.target.value === 'guest' || e.target.value === 'apple') {
              setUserSub(e.target.value + '-' + Math.random().toString(36).substring(2));
            } else if (
              e.target.value === 'unverified' ||
              e.target.value === 'with_phone' ||
              e.target.value === 'unver_phone'
            ) {
              setUserSub(e.target.value + '_' + Math.random().toString(36).substring(2));
            } else {
              setUserSub(e.target.value);
            }
          }, [])}
        />
        <button disabled={loggingIn} type="submit">
          Login
        </button>
      </form>
      <p>redirect url: {redirectUrl}</p>
      {interests.state === 'loading' && <p>Interests: Loading</p>}
      {interests.state === 'unavailable' && <p>Interests: Unavailable</p>}
      {interests.state === 'loaded' && (
        <>
          <p>Interests:</p>
          <ul>
            {interests.interests.map((int) => (
              <li>{int === interests.primaryInterest ? <b>{int}</b> : int}</li>
            ))}
          </ul>
        </>
      )}
      <p>Log:</p>
      <RenderGuardedComponent props={log} component={(lg) => <pre>{lg}</pre>} />
    </div>
  );
};
