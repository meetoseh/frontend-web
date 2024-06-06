import { ReactElement, useContext, useMemo } from 'react';
import { User } from '../../User';
import { CrudItemBlock } from '../../../crud/CrudItemBlock';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../../../crud/CrudFetcher';
import { UserClientScreenLog, userClientScreenLogMapper } from './UserClientScreenLog';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsSetState } from '../../../../shared/lib/adaptValueWithCallbacksAsSetState';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import styles from './BigUserClientScreens.module.css';
import { IconButton } from '../../../../shared/forms/IconButton';
import { UserClientScreen } from './UserClientScreen';

const limit = 16;

/**
 * Shows what screens the user has seen from most to least recent
 */
export const BigUserClientScreens = ({ user }: { user: User }): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const itemsVWC = useWritableValueWithCallbacks<UserClientScreenLog[]>(() => []);
  const loadingVWC = useWritableValueWithCallbacks(() => true);
  const haveMoreVWC = useWritableValueWithCallbacks(() => true);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const userVWC = useReactManagedValueAsValueWithCallbacks(user);
  const filterVWC = useMappedValueWithCallbacks(
    userVWC,
    (user): CrudFetcherFilter => ({
      user_sub: {
        operator: 'eq',
        value: user.sub,
      },
    })
  );
  const sortVWC = useWritableValueWithCallbacks(
    (): CrudFetcherSort => [
      {
        key: 'created_at',
        dir: 'desc',
        before: null,
        after: null,
      },
    ]
  );

  const fetcher = useMemo(
    () =>
      new CrudFetcher(
        '/api/1/admin/logs/user_client_screens',
        userClientScreenLogMapper,
        adaptValueWithCallbacksAsSetState(itemsVWC),
        adaptValueWithCallbacksAsSetState(loadingVWC),
        adaptValueWithCallbacksAsSetState(haveMoreVWC)
      ),
    [haveMoreVWC, itemsVWC, loadingVWC]
  );

  const refreshCounterVWC = useWritableValueWithCallbacks(() => 0);

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, filterVWC, sortVWC, refreshCounterVWC],
    () => {
      const loginContext = loginContextRaw.value.get();
      if (loginContext.state !== 'logged-in') {
        return undefined;
      }

      const cancel = fetcher.resetAndLoadWithCancelCallback(
        filterVWC.get(),
        sortVWC.get(),
        limit,
        loginContext,
        async (e) => {
          setVWC(errorVWC, await describeError(e));
        }
      );
      return cancel;
    }
  );

  return (
    <CrudItemBlock
      title="Screens"
      controls={
        <>
          <IconButton
            icon={styles.refresh}
            srOnlyName="Refresh"
            onClick={() => {
              setVWC(refreshCounterVWC, refreshCounterVWC.get() + 1);
            }}
          />
          <RenderGuardedComponent
            props={haveMoreVWC}
            component={(haveMore) =>
              !haveMore ? (
                <></>
              ) : (
                <IconButton
                  icon={styles.more}
                  srOnlyName="More"
                  onClick={() => {
                    const loginContext = loginContextRaw.value.get();
                    if (loginContext.state !== 'logged-in') {
                      return;
                    }

                    fetcher.loadMore(filterVWC.get(), limit, loginContext);
                  }}
                />
              )
            }
          />
        </>
      }>
      <RenderGuardedComponent
        props={itemsVWC}
        component={(items) => (
          <div className={styles.items}>
            {items.map((item) => (
              <UserClientScreen key={item.uid} user={user} item={item} />
            ))}
          </div>
        )}
      />
    </CrudItemBlock>
  );
};
