import UserApp from './user/UserApp';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminApp, AdminRoutes } from './admin/AdminApp';
import { useEffect } from 'react';
import {
  extractUserAttributes,
  LoginProvider,
  storeAuthTokens,
  storeUserAttributes,
  TokenResponseConfig,
} from './shared/LoginContext';
import { TestLogin } from './shared/TestLogin';
import { LoginApp } from './user/login/LoginApp';
import { OsehPlusUpgradePrompt } from './user/payment/OsehPlusUpgradePrompt';

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
    const refreshToken = args.get('refresh_token');
    if (idToken === null) {
      return;
    }

    const tokens: TokenResponseConfig = { idToken, refreshToken };
    const userAttributes = extractUserAttributes(tokens);

    (async () => {
      await Promise.all([storeAuthTokens(tokens), storeUserAttributes(userAttributes)]);

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
        <Route
          path="/upgrade"
          element={
            <LoginProvider>
              <OsehPlusUpgradePrompt setLoaded={() => {}} />
            </LoginProvider>
          }
        />
        <Route path="/admin" element={<AdminApp />}>
          {AdminRoutes()}
        </Route>
        <Route path="/dev_login" element={<TestLogin />} />
        <Route path="/login" element={<LoginApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
