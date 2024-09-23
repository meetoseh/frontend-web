import { ReactElement, useCallback, useContext } from 'react';
import {
  Callbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { Modals, addModalWithCallbackToRemove } from '../../../../../shared/contexts/ModalContext';
import { SettingsResources } from '../SettingsResources';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { describeError } from '../../../../../shared/forms/ErrorBlock';
import { YesNoModal } from '../../../../../shared/components/YesNoModal';
import { OauthProvider } from '../../../../login/lib/OauthProvider';
import { getMergeProviderUrl } from '../lib/mergeUtils';
import {
  handlePasskeyAuthenticateForMerge,
  handlePasskeyRegisterForMerge,
} from '../../../lib/passkeyHelpers';
import { showYesNoModal } from '../../../../../shared/lib/showYesNoModal';

export const useManageConnectWithProvider = ({
  resources,
  mergeError,
  modals,
  passkeyHint,
}: {
  resources: SettingsResources;
  mergeError: WritableValueWithCallbacks<ReactElement | null>;
  modals: WritableValueWithCallbacks<Modals>;
  passkeyHint: 'ask' | 'register' | 'authenticate';
}): ((provider: OauthProvider, name: string) => Promise<void>) => {
  const loginContextRaw = useContext(LoginContext);

  const manageConnectWithTypicalProvider = useCallback(
    async (provider: OauthProvider, name: string): Promise<void> => {
      const identities = resources.identities.get();
      const providerIdentities =
        identities !== null ? identities.filter((f) => f.provider === provider) : [];
      const isFirstForProvider = providerIdentities.length === 0;
      const loginContextUnch = loginContextRaw.value.get();

      if (loginContextUnch.state !== 'logged-in') {
        setVWC(mergeError, <>You need to login again</>);
        return;
      }
      const loginContext = loginContextUnch;

      setVWC(mergeError, null);

      let mergeLink: string;
      try {
        mergeLink = await getMergeProviderUrl(loginContext, provider);
      } catch (e) {
        setVWC(mergeError, await describeError(e));
        return;
      }

      const requestDismiss = createWritableValueWithCallbacks(() => {});

      const closeModalCallbacks = new Callbacks<undefined>();
      const modal = (
        <YesNoModal
          title={`Connect with ${name}`}
          body={
            `You will be redirected to connect a new login identity. ` +
            (isFirstForProvider
              ? `Doing so will allow you to login using ${name} in the future.`
              : `If you select a different ${name} account than the one${
                  providerIdentities.length === 1 ? '' : 's'
                } you already ` +
                `have connected, you will be able to login with ` +
                (providerIdentities.length === 1 ? 'either' : 'any of them') +
                ` in the future.`)
          }
          cta1="Cancel"
          cta2="Connect"
          onClickOne={async () => requestDismiss.get()()}
          onClickTwo={mergeLink}
          emphasize={2}
          onDismiss={() => closeModalCallbacks.call(undefined)}
          requestDismiss={requestDismiss}
        />
      );

      const closeModal = addModalWithCallbackToRemove(modals, modal);
      closeModalCallbacks.add(() => closeModal());
    },
    [loginContextRaw, mergeError, modals, resources]
  );

  const manageConnectWithPasskey = useCallback(
    async (provider: 'Passkey', name: string): Promise<void> => {
      const loginRaw = loginContextRaw.value.get();
      if (loginRaw.state !== 'logged-in') {
        return;
      }
      const login = loginRaw;

      setVWC(mergeError, null);

      let technique = passkeyHint;
      if (technique === 'ask') {
        const response = await showYesNoModal(modals, {
          title: 'Passkey',
          body: 'Would you like to register a new passkey or connect an existing one?',
          cta1: 'Register',
          cta2: 'Connect',
          emphasize: 1,
        }).promise;
        if (response === true) {
          technique = 'register';
        } else if (response === false) {
          technique = 'authenticate';
        } else {
          return;
        }
      }

      try {
        let mergeInfo: { mergeToken: string };
        if (technique === 'register') {
          mergeInfo = await handlePasskeyRegisterForMerge(login);
        } else {
          mergeInfo = await handlePasskeyAuthenticateForMerge(login);
        }
        window.location.assign('/#merge_token=' + mergeInfo.mergeToken);
        window.location.reload();
      } catch (e) {
        const described = await describeError(e);
        setVWC(mergeError, described);
      }
    },
    [loginContextRaw]
  );

  const manageConnectWithProvider = useCallback(
    (provider: OauthProvider, name: string): Promise<void> => {
      if (provider === 'Passkey') {
        return manageConnectWithPasskey(provider, name);
      } else if (provider === 'Silent') {
        return Promise.reject(new Error('Silent is unsupported in this context'));
      } else {
        return manageConnectWithTypicalProvider(provider, name);
      }
    },
    [manageConnectWithPasskey, manageConnectWithTypicalProvider]
  );

  return manageConnectWithProvider;
};
