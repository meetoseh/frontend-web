import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../../models/Feature';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { ConfirmMergeAccountState } from '../ConfirmMergeAccountState';
import { useWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { ConfirmMergeAccountWrapper } from './ConfirmMergeAccountWrapper';
import styles from './styles.module.css';
import { ListLoginOptions } from './ListLoginOptions';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { Button } from '../../../../../shared/forms/Button';

export const NoChangeRequired = ({
  resources,
  state,
}: FeatureComponentProps<ConfirmMergeAccountState, ConfirmMergeAccountResources>): ReactElement => {
  const closeDisabled = useWritableValueWithCallbacks(() => false);
  const onDismiss = useWritableValueWithCallbacks(() => () => {});

  return (
    <ConfirmMergeAccountWrapper
      state={state}
      resources={resources}
      closeDisabled={closeDisabled}
      onDismiss={onDismiss}>
      <div className={styles.title}>Accounts Already Linked</div>
      <div className={styles.description}>
        Your accounts are already linked. You can continue to login with{' '}
        <ListLoginOptions state={state} resources={resources} />
      </div>
      <div className={styles.buttonContainer}>
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
              spinner={disabled}
              variant="filled-white"
              fullWidth>
              Ok
            </Button>
          )}
        />
      </div>
    </ConfirmMergeAccountWrapper>
  );
};
