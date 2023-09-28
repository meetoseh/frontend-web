import { ReactElement } from 'react';
import { LoginApp } from '../../../login/LoginApp';
import { FeatureComponentProps } from '../../models/Feature';
import { LoginState } from './LoginState';
import { LoginResources } from './LoginResources';
import { useUnwrappedValueWithCallbacks } from '../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { IsaiahCourseLoginScreen } from '../isaiahCourse/IsaiahCourseLoginScreen';

/**
 * The component used for the login feature. This currently doesn't
 * completely respect the state/resources breakdown by the feature
 * system for convenience of allowing the login components to be
 * rendered outside the feature system, which might no longer be
 * necessary.
 */
export const Login = ({
  state,
  resources,
}: FeatureComponentProps<LoginState, LoginResources>): ReactElement => {
  const variant = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.variant)
  );

  if (variant === 'isaiah') {
    return <IsaiahCourseLoginScreen />;
  }

  return <LoginApp />;
};
