import UserApp from './user/UserApp';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminApp, AdminRoutes } from './admin/AdminApp';
import { useEffect } from 'react';
import {
  extractUserAttributes,
  storeAuthTokens,
  storeUserAttributes,
  TokenResponseConfig,
} from './shared/LoginContext';
import { TestLogin } from './shared/TestLogin';
import { apiFetch } from './shared/ApiConstants';

function App() {
  useEffect(() => {
    const fragment = window.location.hash;
    if (fragment === '') {
      return;
    }

    let args: URLSearchParams;
    try {
      args = new URLSearchParams(fragment.substring(1));
    } catch {
      return;
    }

    if (!args.has('id_token')) {
      return;
    }

    const idToken = args.get('id_token');
    const accessToken = args.get('access_token');
    if (idToken === null) {
      return;
    }

    const tokens: TokenResponseConfig = { idToken, accessToken };
    const userAttributes = extractUserAttributes(tokens);

    (async () => {
      await Promise.all([
        storeAuthTokens(tokens),
        storeUserAttributes(userAttributes),
        apiFetch(
          '/api/1/users/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Authorization: `bearer ${tokens.idToken}`,
            },
          },
          null
        ).catch(console.error),
      ]);

      const redirectLoc = localStorage.getItem('login-redirect');
      if (redirectLoc) {
        localStorage.removeItem('login-redirect');
        window.location.href = redirectLoc;
        return;
      }

      window.location.hash = '';
    })();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserApp />} />
        <Route path="/admin" element={<AdminApp />}>
          {AdminRoutes()}
        </Route>
        <Route path="/dev_login" element={<TestLogin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
