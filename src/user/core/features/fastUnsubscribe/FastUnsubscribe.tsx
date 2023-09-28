import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { FastUnsubscribeResources } from './FastUnsubscribeResources';
import { FastUnsubscribeState } from './FastUnsubscribeState';
import { useUnwrappedValueWithCallbacks } from '../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { FastUnsubscribeLoggedIn } from './FastUnsubscribeLoggedIn';
import { FastUnsubscribeLoggedOut } from './FastUnsubscribeLoggedOut';

/**
 * The  fast unsubscribe screen which either allows the user
 * to enter an email address to unsubscribe (for logged out users) or
 * allows removing sms/email/push reminders (for logged in users).
 */
export const FastUnsubscribe = ({
  state,
  resources,
}: FeatureComponentProps<FastUnsubscribeState, FastUnsubscribeResources>): ReactElement => {
  const variant = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.variant)
  );

  if (variant === 'logged-in') {
    return <FastUnsubscribeLoggedIn state={state} resources={resources} />;
  }
  return <FastUnsubscribeLoggedOut state={state} resources={resources} />;
};
