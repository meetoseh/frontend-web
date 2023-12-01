import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../../models/Feature';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { ConfirmMergeAccountState } from '../ConfirmMergeAccountState';
import { useWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { ConfirmMergeAccountWrapper } from './ConfirmMergeAccountWrapper';
import styles from './styles.module.css';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { Button } from '../../../../../shared/forms/Button';

export const ReviewReminders = ({
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
      <div className={styles.title}>Would you like to review your reminder settings?</div>
      <div className={styles.description}>
        Take a moment to review how and when you receive reminders
      </div>
      <div className={styles.buttonContainer}>
        <RenderGuardedComponent
          props={closeDisabled}
          component={(disabled) => (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (closeDisabled.get()) {
                  return;
                }

                resources.get().session?.storeAction('goto_review_notifications', null);
                resources.get().session?.reset();
                resources.get().requestNotificationTimes();
                state.get().onReviewReminderSettingsPrompted();
              }}
              disabled={disabled}
              spinner={disabled}
              variant="filled-white"
              fullWidth>
              Review Reminder Settings
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
                state.get().onReviewReminderSettingsPrompted();
              }}
              disabled={disabled}
              variant="link-white"
              fullWidth>
              Skip
            </Button>
          )}
        />
      </div>
    </ConfirmMergeAccountWrapper>
  );
};
