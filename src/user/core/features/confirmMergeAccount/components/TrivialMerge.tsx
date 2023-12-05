import { ReactElement, useContext } from 'react';
import { FeatureComponentProps } from '../../../models/Feature';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { ConfirmMergeAccountState } from '../ConfirmMergeAccountState';
import { ConfirmMergeAccountWrapper } from './ConfirmMergeAccountWrapper';
import styles from './styles.module.css';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { useWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { Button } from '../../../../../shared/forms/Button';
import { ListLoginOptions } from './ListLoginOptions';

export const TrivialMerge = ({
  resources,
  state,
}: FeatureComponentProps<ConfirmMergeAccountState, ConfirmMergeAccountResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const givenName = loginContext.userAttributes?.givenName;

  const closeDisabled = useWritableValueWithCallbacks(() => false);
  const onDismiss = useWritableValueWithCallbacks(() => () => {});

  return (
    <ConfirmMergeAccountWrapper
      state={state}
      resources={resources}
      closeDisabled={closeDisabled}
      onDismiss={onDismiss}>
      <div className={styles.title}>All set{givenName && <>, {givenName}</>}</div>
      <div className={styles.description}>
        You have successfully merged your two accounts. You can now login with{' '}
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
