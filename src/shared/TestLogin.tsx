import './TestLogin.css';
import { ChangeEvent, FormEvent, ReactElement, useCallback, useContext, useState } from 'react';
import { apiFetch } from './ApiConstants';
import { InterestsContext } from './InterestsContext';

/**
 * Shows a development page where you can login just be specifying your user
 * sub. Only works in the dev environment when targeting a local server.
 *
 * Should be within an interests provider for similarity to the regular
 * login flow.
 */
export const TestLogin = (): ReactElement => {
  const [loggingIn, setLoggingIn] = useState(false);
  const [userSub, setUserSub] = useState('timothy');
  const interests = useContext(InterestsContext);

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

  return (
    <div className="TestLogin">
      <h1>Login</h1>
      <form onSubmit={login}>
        <label htmlFor="userSub">User Sub</label>
        <input
          type="text"
          id="userSub"
          name="userSub"
          value={userSub}
          onChange={useCallback((e: ChangeEvent<HTMLInputElement>) => {
            if (e.target.value === 'guest' || e.target.value === 'apple') {
              setUserSub(e.target.value + '-' + Math.random().toString(36).substring(2));
            } else {
              setUserSub(e.target.value);
            }
          }, [])}
        />
        <button disabled={loggingIn} type="submit">
          Login
        </button>
      </form>
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
    </div>
  );
};
