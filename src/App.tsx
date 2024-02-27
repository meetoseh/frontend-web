import './shared/icons.module.css';
import './shared/buttons.module.css';
import UserApp from './user/UserApp';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminApp, AdminRoutes } from './admin/AdminApp';
import { useEffect, useRef, useState } from 'react';
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
import { DebugFeatures } from './dbg/features/DebugFeatures';
import { getLoginRedirect, setLoginRedirect } from './user/login/lib/LoginRedirectStore';

function App() {
  const [handlingLogin, setHandlingLogin] = useState(true);
  let alreadyHandlingLogin = useRef(false);

  useEffect(() => {
    if (alreadyHandlingLogin.current) {
      return;
    }
    alreadyHandlingLogin.current = true;

    const fragment = window.location.hash;
    if (fragment.length < 2) {
      setHandlingLogin(false);
      return;
    }

    let args: URLSearchParams;
    try {
      args = new URLSearchParams(fragment.substring(1));
    } catch {
      setHandlingLogin(false);
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

      const redirectLoc = await getLoginRedirect();
      if (redirectLoc !== null) {
        await setLoginRedirect(null);
        window.location.assign(redirectLoc.url);
      } else {
        const urlWithoutHash = new URL(window.location.href);
        urlWithoutHash.hash = '';
        const urlWithoutHashStr = urlWithoutHash.toString();
        if (urlWithoutHashStr !== window.location.href) {
          window.location.assign(urlWithoutHashStr);
        }
      }

      setTimeout(() => {
        setHandlingLogin(false);
      }, 250);
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
        <Route path="/series" element={<UserApp />} />
        <Route path="/series/preview/*" element={<UserApp />} />
        <Route path="/series/details/*" element={<UserApp />} />
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
                  <LoginApp />
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
              <ModalProvider>
                <CourseActivateScreen />
              </ModalProvider>
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
        <Route path="/debug-features" element={<DebugFeatures />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
