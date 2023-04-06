import UserApp from './user/UserApp';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminApp, AdminRoutes } from './admin/AdminApp';
import { useEffect, useState } from 'react';
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
import { Settings } from './user/settings/Settings';
import { ModalProvider } from './shared/ModalContext';
import { SplashScreen } from './user/splash/SplashScreen';
import { HandleDailyEventUserInviteScreen } from './user/referral/HandleDailyEventUserInviteScreen';
import { ConnectivityScreen } from './user/connectivity/ConnectivityScreen';
import { VisitorHandler } from './shared/hooks/useVisitor';

function App() {
  const [handlingLogin, setHandlingLogin] = useState(true);

  useEffect(() => {
    const fragment = window.location.hash;
    if (fragment === '') {
      setHandlingLogin(false);
      return;
    }

    let args: URLSearchParams;
    try {
      args = new URLSearchParams(fragment.substring(1));
    } catch {
      return;
    }

    if (!args.has('id_token')) {
      setHandlingLogin(false);
      return;
    }

    const idToken = args.get('id_token');
    const refreshToken = args.get('refresh_token');
    const onboard = args.get('onboard') === '1';
    if (idToken === null) {
      setHandlingLogin(false);
      return;
    }

    const tokens: TokenResponseConfig = { idToken, refreshToken };
    const userAttributes = extractUserAttributes(tokens);

    if (onboard) {
      localStorage.setItem('onboard', '1');
    } else {
      localStorage.removeItem('onboard');
    }

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

  if (handlingLogin) {
    return <SplashScreen type="wordmark" />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserApp />} />
        <Route
          path="/upgrade"
          element={
            <LoginProvider>
              <OsehPlusUpgradePrompt setLoaded={() => {}} />
              <VisitorHandler />
            </LoginProvider>
          }
        />
        <Route
          path="/settings"
          element={
            <LoginProvider>
              <VisitorHandler />
              <ModalProvider>
                <Settings />
              </ModalProvider>
            </LoginProvider>
          }
        />
        <Route path="/admin" element={<AdminApp />}>
          {AdminRoutes()}
        </Route>
        <Route
          path="/dev_login"
          element={
            <LoginProvider>
              <VisitorHandler />
              <TestLogin />
            </LoginProvider>
          }
        />
        <Route
          path="/login"
          element={
            <LoginProvider>
              <VisitorHandler />
              <LoginApp redirectUrl="/" />
            </LoginProvider>
          }
        />
        <Route
          path="/connectivity"
          element={
            <LoginProvider>
              <VisitorHandler />
              <ConnectivityScreen />
            </LoginProvider>
          }
        />
        <Route
          path="/splash"
          element={
            <LoginProvider>
              <VisitorHandler />
              <SplashScreen />
            </LoginProvider>
          }
        />
        <Route
          path="/splash-alt"
          element={
            <LoginProvider>
              <VisitorHandler />
              <SplashScreen type="wordmark" />
            </LoginProvider>
          }
        />
        <Route path="/i/:code" element={<HandleDailyEventUserInviteScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
