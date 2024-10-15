import { ReactElement, useContext, useMemo } from 'react';
import { User } from '../../User';
import { CrudItemBlock } from '../../../crud/CrudItemBlock';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../../../crud/CrudFetcher';
import { UserClientScreenLog } from './UserClientScreenLog';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsSetState } from '../../../../shared/lib/adaptValueWithCallbacksAsSetState';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import styles from './UserClientScreenActions.module.css';
import { IconButton } from '../../../../shared/forms/IconButton';
import {
  UserClientScreenActionLog,
  userClientScreenActionLogMapper,
} from './UserClientScreenActionLog';
import { UserClientScreenAction } from './UserClientScreenAction';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { CrudFormElement } from '../../../crud/CrudFormElement';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { DisplayableError, SimpleDismissBoxError } from '../../../../shared/lib/errors';

const limit = 16;

/**
 * Shows what actions the user took in the given screen
 */
export const UserClientScreenActions = ({
  user,
  screen,
}: {
  user: User;
  screen: UserClientScreenLog;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const itemsVWC = useWritableValueWithCallbacks<UserClientScreenActionLog[]>(() => []);
  const loadingVWC = useWritableValueWithCallbacks(() => true);
  const haveMoreVWC = useWritableValueWithCallbacks(() => true);
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);

  const screenVWC = useReactManagedValueAsValueWithCallbacks(screen);
  const filterVWC = useMappedValueWithCallbacks(
    screenVWC,
    (screen): CrudFetcherFilter => ({
      user_client_screen_log_uid: {
        operator: 'eq',
        value: screen.uid,
      },
    })
  );
  const sortVWC = useWritableValueWithCallbacks(
    (): CrudFetcherSort => [
      {
        key: 'created_at',
        dir: 'asc',
        before: null,
        after: null,
      },
    ]
  );

  const fetcher = useMemo(
    () =>
      new CrudFetcher(
        '/api/1/admin/logs/user_client_screen_actions',
        userClientScreenActionLogMapper,
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
          setVWC(
            errorVWC,
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'fetch actions', `${e}`)
          );
        }
      );
      return cancel;
    }
  );

  return (
    <div className={styles.container}>
      <CrudItemBlock title={screen.screen.slug} controls={null} containsNested>
        <SimpleDismissBoxError error={errorVWC} />
        <CrudFormElement title="Peeked By" noTopMargin>
          {screen.user.givenName} {screen.user.familyName} ({screen.user.sub})
        </CrudFormElement>
        <CrudFormElement title="Peek UID">{screen.uid}</CrudFormElement>
        <CrudFormElement title="Peeked At">{screen.createdAt.toLocaleString()}</CrudFormElement>
        <CrudFormElement title="Platform">{screen.platform}</CrudFormElement>
        <CrudFormElement title="Parameters">
          <div className={styles.parameters}>
            {JSON.stringify(screen.screen.parameters, undefined, 2)}
          </div>
        </CrudFormElement>
        <VerticalSpacer height={32} />
        <CrudItemBlock
          title="Actions"
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
                  <UserClientScreenAction key={item.uid} item={item} />
                ))}
              </div>
            )}
          />
          <HorizontalSpacer width={600} />
        </CrudItemBlock>
      </CrudItemBlock>
    </div>
  );
};
