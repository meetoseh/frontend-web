import { ReactElement, useCallback, useContext } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { AdminDashboardTopBlock } from './AdminDashboardTopBlock';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';

type AdminDashboardSimpleTopBlockProps = {
  /**
   * The class to apply to the element which should act as the
   * icon for this number, e.g., a silhouette for total members
   */
  iconClassName: string;

  /**
   * The path to use to fetch the value
   */
  path: string;

  /**
   * The label to use for this number
   */
  label: string;
};

/**
 * Renders a simple top block whose value is fetched from a GET endpoint with
 * no arguments where the returned value is a json object with a `value` field
 */
export const AdminDashboardSimpleTopBlock = ({
  iconClassName,
  path,
  label,
}: AdminDashboardSimpleTopBlockProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const value = useWritableValueWithCallbacks(() => 0);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchValue();
        return () => {
          active = false;
        };

        async function fetchValue() {
          const response = await apiFetch(path, {}, loginContext);
          if (!active) {
            return;
          }

          if (!response.ok) {
            const text = await response.text();
            if (!active) {
              return;
            }
            console.log("Couldn't fetch simple top block value", response, text);
            return;
          }

          const data = await response.json();
          if (!active) {
            return;
          }
          setVWC(value, data.value);
        }
      },
      [path, value]
    )
  );

  return (
    <RenderGuardedComponent
      props={value}
      component={(value) => (
        <AdminDashboardTopBlock iconClassName={iconClassName} value={value} label={label} />
      )}
    />
  );
};
