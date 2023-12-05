import { ReactElement, useCallback, useContext } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { MergeProvider } from '../../mergeAccount/MergeAccountState';
import { Modals, addModalWithCallbackToRemove } from '../../../../../shared/contexts/ModalContext';
import { SettingsResources } from '../SettingsResources';
import { getMergeProviderUrl } from '../../mergeAccount/utils';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { describeError } from '../../../../../shared/forms/ErrorBlock';
import { YesNoModal } from '../../../../../shared/components/YesNoModal';

export const useManageConnectWithProvider = ({
  resources,
  mergeError,
  modals,
}: {
  resources: ValueWithCallbacks<SettingsResources>;
  mergeError: WritableValueWithCallbacks<ReactElement | null>;
  modals: WritableValueWithCallbacks<Modals>;
}): ((provider: MergeProvider, name: string) => Promise<void>) => {
  const loginContext = useContext(LoginContext);

  const manageConnectWithProvider = useCallback(
    async (provider: MergeProvider, name: string): Promise<void> => {
      const identities = resources.get().identities;
      const providerIdentities =
        identities.type === 'success'
          ? identities.identities.filter((f) => f.provider === provider)
          : [];
      const isFirstForProvider = providerIdentities.length === 0;

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
            `You will be redirected to connect a new identity. ` +
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
    [loginContext, mergeError, modals, resources]
  );

  return manageConnectWithProvider;
};
