import { useCallback, useContext } from 'react';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import { showYesNoModal } from '../../../../shared/lib/showYesNoModal';
import { ScreenContext } from '../../hooks/useScreenContext';
import { setVWC } from '../../../../shared/lib/setVWC';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import styles from './Login.module.css';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { ProvidersList, ProvidersListItem } from '../../../login/components/ProvidersList';
import { useOauthProviderUrlsValueWithCallbacks } from '../../../login/hooks/useOauthProviderUrlsValueWithCallbacks';
import {
  handlePasskeyAuthenticateForLogin,
  handlePasskeyRegisterForLogin,
} from '../../lib/passkeyHelpers';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useIsSilentAuthSupportedVWC } from '../../lib/useIsSilentAuthSupportedVWC';
import { useIsPasskeyAuthSupportedVWC } from '../../lib/useIsPasskeyAuthSupportedVWC';
import { useIsGoogleAuthSupportedVWC } from '../../lib/useIsGoogleAuthSupported';
import { DisplayableError } from '../../../../shared/lib/errors';

/**
 * The standard full screen component for logging in, which
 * presents the user with options to log in with Google, Apple,
 * or Direct
 */
export const Login = ({ ctx }: { ctx: ScreenContext }) => {
  const modalContext = useContext(ModalContext);
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useErrorModal(modalContext.modals, errorVWC);

  const onContinueWithProvider = useCallback(
    async (provider: 'Passkey' | 'Silent') => {
      if (provider === 'Passkey') {
        const response = await showYesNoModal(modalContext.modals, {
          title: 'Passkey',
          body: 'Would you like to register a new passkey or sign in with an existing one?',
          cta1: 'Register',
          cta2: 'Sign in',
          emphasize: 1,
        }).promise;

        if (response === null) {
          return;
        }

        const technique = response ? 'register' : 'authenticate';

        try {
          if (technique === 'register') {
            const tokens = await handlePasskeyRegisterForLogin();
            ctx.login.setAuthTokens(tokens);
          } else {
            const tokens = await handlePasskeyAuthenticateForLogin();
            ctx.login.setAuthTokens(tokens);
          }
        } catch (e) {
          const described =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'handle passkey login', `${e}`);
          setVWC(errorVWC, described);
        }
        return;
      }

      if (provider === 'Silent') {
        await ctx.login.setSilentAuthPreference({ type: 'preferred' });
        return;
      }

      setVWC(errorVWC, new DisplayableError('client', 'handle login', `${provider} unsupported`));
    },
    [ctx, errorVWC, modalContext.modals]
  );

  const urlProvidersVWC = useWritableValueWithCallbacks<OauthProvider[]>(() => [
    'Google',
    'SignInWithApple',
    'Direct',
  ]);

  const isSilentAuthSupportedVWC = useIsSilentAuthSupportedVWC();
  const isPasskeyAuthSupportedVWC = useIsPasskeyAuthSupportedVWC();
  const isGoogleAuthSupportedVWC = useIsGoogleAuthSupportedVWC();

  const [urlProviderItemsVWC, urlProviderItemsErrorVWC] =
    useOauthProviderUrlsValueWithCallbacks(urlProvidersVWC);
  useErrorModal(modalContext.modals, urlProviderItemsErrorVWC);

  const providerListItemsVWC = useMappedValuesWithCallbacks(
    [
      isSilentAuthSupportedVWC,
      isPasskeyAuthSupportedVWC,
      isGoogleAuthSupportedVWC,
      urlProviderItemsVWC,
    ],
    (): ProvidersListItem[] => {
      const silentAuth = isSilentAuthSupportedVWC.get().value;
      const passkeyAuth = isPasskeyAuthSupportedVWC.get().value;
      const googleAuth = isGoogleAuthSupportedVWC.get().value;

      const urlProviderItems = urlProviderItemsVWC.get();
      const filteredProviderItems = googleAuth
        ? urlProviderItems
        : urlProviderItems.filter((i) => i.provider !== 'Google');

      if (!silentAuth && !passkeyAuth) {
        return filteredProviderItems;
      }
      return [
        ...(silentAuth
          ? ([{ provider: 'Silent', onClick: () => onContinueWithProvider('Silent') }] as const)
          : []),
        ...(passkeyAuth
          ? ([{ provider: 'Passkey', onClick: () => onContinueWithProvider('Passkey') }] as const)
          : []),
        ...filteredProviderItems.map((urlItem) => ({ ...urlItem, deemphasize: true })),
      ];
    }
  );

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        gridSizeVWC={ctx.windowSizeImmediate}
        contentWidthVWC={ctx.contentWidth}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.row}>
          <HorizontalSpacer width={0} flexGrow={1} />
          <div className={styles.logo} />
          <HorizontalSpacer width={0} flexGrow={1} />
        </div>
        <VerticalSpacer height={0} maxHeight={24} flexGrow={1} />
        <div className={styles.row}>
          <HorizontalSpacer width={0} flexGrow={1} />
          <div className={styles.message}>Reclaim your Calm</div>
          <HorizontalSpacer width={0} flexGrow={1} />
        </div>
        <VerticalSpacer height={0} maxHeight={48} flexGrow={1} />
        <RenderGuardedComponent
          props={providerListItemsVWC}
          component={(items) => <ProvidersList items={items} />}
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
