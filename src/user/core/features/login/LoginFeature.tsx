import { useContext, useEffect, useMemo } from 'react';
import { Feature } from '../../models/Feature';
import { LoginResources, LoginVariant } from './LoginResources';
import { LoginState } from './LoginState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { getUTMFromURL } from '../../../../shared/hooks/useVisitor';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { Login } from './Login';

/**
 * Shows the login screen if the user is not logged in. Keeping this as a
 * feature is both convenient for consistency with other features, and allows
 * features that take over the login screen by placing them at a higher
 * precedence.
 *
 * An alternative to a feature for taking over the login screen is the variant
 * field on this login resources, though it's not as flexible.
 */
export const LoginFeature: Feature<LoginState, LoginResources> = {
  identifier: 'login',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);

    const requiredVWC = useWritableValueWithCallbacks<boolean | undefined>(() => undefined);

    useEffect(() => {
      if (loginContext.state === 'loading') {
        setVWC(requiredVWC, undefined);
        return;
      }

      if (loginContext.state === 'logged-in') {
        setVWC(requiredVWC, false);
        return;
      }

      setVWC(requiredVWC, true);
    }, [loginContext, requiredVWC]);

    return useMappedValuesWithCallbacks(
      [requiredVWC],
      (): LoginState => ({
        required: requiredVWC.get(),
      })
    );
  },
  isRequired: (state) => state.required,
  useResources: (state, required) => {
    const utm = useMemo(() => getUTMFromURL(), []);
    const variantVWC = useWritableValueWithCallbacks<LoginVariant>(() => {
      if (
        utm !== null &&
        utm.campaign === 'course' &&
        (utm.content === 'affirmation-course' || utm.content === 'elevate-within')
      ) {
        return 'isaiah';
      }
      return 'default';
    });

    return useMappedValuesWithCallbacks([state, variantVWC], () => {
      const s = state.get();
      if (!s.required) {
        return {
          loading: true,
          variant: undefined,
        };
      }

      return {
        loading: false,
        variant: variantVWC.get(),
      };
    });
  },
  component: (state, resources) => <Login state={state} resources={resources} />,
};
