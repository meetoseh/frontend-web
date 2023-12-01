import { ReactElement, useContext } from 'react';
import { FeatureComponentProps } from '../../../models/Feature';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { ConfirmMergeAccountState } from '../ConfirmMergeAccountState';
import { ConfirmMergeAccountWrapper } from './ConfirmMergeAccountWrapper';
import { useWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import styles from './styles.module.css';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { Button } from '../../../../../shared/forms/Button';
import { ModalContext } from '../../../../../shared/contexts/ModalContext';
import { useErrorModal } from '../../../../../shared/hooks/useErrorModal';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../../shared/lib/setVWC';

export const ContactSupport = ({
  resources,
  state,
}: FeatureComponentProps<ConfirmMergeAccountState, ConfirmMergeAccountResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const givenName = loginContext.userAttributes?.givenName;
  const closeDisabled = useWritableValueWithCallbacks(() => false);
  const onDismiss = useWritableValueWithCallbacks(() => () => {});

  const error = useWritableValueWithCallbacks(() => state.get().error);
  useValueWithCallbacksEffect(state, (s) => {
    setVWC(error, s.error);
    return undefined;
  });

  useErrorModal(modalContext.modals, error, 'merging accounts');

  return (
    <ConfirmMergeAccountWrapper
      state={state}
      resources={resources}
      closeDisabled={closeDisabled}
      onDismiss={onDismiss}>
      <div className={styles.title}>{givenName ? <>{givenName},</> : <>Contact support</>}</div>
      <div className={styles.description}>
        Sorry, something went wrong when trying to merge your accounts. Please contact hi@oseh.com
        for assistance.
      </div>
      <div className={styles.buttonContainer}>
        <RenderGuardedComponent
          props={closeDisabled}
          component={(disabled) => (
            <Button
              type="button"
              onClick="mailto:hi@oseh.com?subject=Error merging accounts"
              onLinkClick={() => {
                onDismiss.get()();
              }}
              disabled={disabled}
              spinner={disabled}
              variant="filled-white"
              fullWidth>
              Open Email
            </Button>
          )}
        />
        <RenderGuardedComponent
          props={closeDisabled}
          component={(disabled) => (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onDismiss.get()();
              }}
              disabled={disabled}
              variant="link-white"
              fullWidth>
              Back to Safety
            </Button>
          )}
        />
      </div>
    </ConfirmMergeAccountWrapper>
  );
};
