import './shared/icons.module.css';
import './shared/buttons.module.css';
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
} from './shared/contexts/LoginContext';
import { TestLogin } from './shared/TestLogin';
import { LoginApp } from './user/login/LoginApp';
import { OsehPlusUpgradePrompt } from './user/payment/OsehPlusUpgradePrompt';
import { SplashScreen } from './user/splash/SplashScreen';
import { ConnectivityScreen } from './user/connectivity/ConnectivityScreen';
import { CourseActivateScreen } from './user/courses/CourseActivateScreen';
import { CourseAttachScreen } from './user/courses/CourseAttachScreen';
import { CourseDownloadScreen } from './user/courses/CourseDownloadScreen';
import { JourneyPublicLink } from './user/journey/JourneyPublicLink';
import { InterestsAutoProvider } from './shared/contexts/InterestsContext';
import { AnxietyLanding } from './user/landing/AnxietyLanding';
import { ModalProvider } from './shared/contexts/ModalContext';
import { ClearCache } from './user/connectivity/ClearCache';

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
              <InterestsAutoProvider>
                <OsehPlusUpgradePrompt />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route path="/settings" element={<UserApp />} />
        <Route path="/admin" element={<AdminApp />}>
          {AdminRoutes()}
        </Route>
        <Route
          path="/dev_login"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <TestLogin />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/login"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <ModalProvider>
                  <LoginApp redirectUrl="/" />
                </ModalProvider>
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/connectivity"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <ConnectivityScreen />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/splash"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <SplashScreen />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/splash-alt"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <SplashScreen type="wordmark" />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/sms-test"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <div>
                  <a href="sms://+15552345678;?&body=Hello%20World">one recipient only with body</a>
                </div>
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/courses/activate"
          element={
            <LoginProvider>
              <CourseActivateScreen />
            </LoginProvider>
          }
        />
        <Route
          path="/courses/attach"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <CourseAttachScreen />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/courses/download"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <CourseDownloadScreen />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route
          path="/jpl"
          element={
            <LoginProvider>
              <JourneyPublicLink />
            </LoginProvider>
          }
        />
        <Route
          path="/anxiety"
          element={
            <LoginProvider>
              <InterestsAutoProvider>
                <AnxietyLanding />
              </InterestsAutoProvider>
            </LoginProvider>
          }
        />
        <Route path="/favorites" element={<UserApp />} />
        <Route path="/l/*" element={<UserApp />} />
        <Route path="/a/*" element={<UserApp />} />
        <Route path="/clear" element={<ClearCache />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
