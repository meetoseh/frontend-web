import './shared/icons.module.css';
import './shared/buttons.module.css';
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
import { getLoginRedirect, setLoginRedirect } from './user/login/lib/LoginRedirectStore';
import UserScreensApp from './user/UserScreensApp';

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
    if (idToken === null) {
      setHandlingLogin(false);
      return;
    }

    const tokens: TokenResponseConfig = { idToken, refreshToken };
    const userAttributes = extractUserAttributes(tokens);

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

  const stdApp = <UserScreensApp />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={stdApp} />
        <Route path="/upgrade" element={stdApp} />
        <Route path="/settings" element={stdApp} />
        <Route path="/settings/manage-membership" element={stdApp} />
        <Route path="/series" element={stdApp} />
        <Route path="/series/preview/*" element={stdApp} />
        <Route path="/series/details/*" element={stdApp} />
        <Route path="/emotions/*" element={stdApp} />
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
        <Route path="/login" element={stdApp} />
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
        <Route path="/favorites" element={stdApp} />
        <Route path="/l/*" element={stdApp} />
        <Route path="/a/*" element={stdApp} />
        <Route path="/clear" element={<ClearCache />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
