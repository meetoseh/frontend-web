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

export const useManageConnectWithProvider = ({
  resources,
  mergeError,
  modals,
}: {
  resources: SettingsResources;
  mergeError: WritableValueWithCallbacks<ReactElement | null>;
  modals: WritableValueWithCallbacks<Modals>;
}): ((provider: OauthProvider, name: string) => Promise<void>) => {
  const loginContextRaw = useContext(LoginContext);

  const manageConnectWithProvider = useCallback(
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

  return manageConnectWithProvider;
};
