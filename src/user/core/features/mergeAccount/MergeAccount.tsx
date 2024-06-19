import { ReactElement, useCallback, useMemo, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { MergeAccountState } from './MergeAccountState';
import { MergeAccountResources } from './MergeAccountResources';
import styles from './MergeAccount.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useFullHeight } from '../../../../shared/hooks/useFullHeight';
import { IconButton } from '../../../../shared/forms/IconButton';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import { ProvidersList, ProvidersListItem } from '../../../login/components/ProvidersList';

export const MergeAccount = ({
  resources,
  state,
}: FeatureComponentProps<MergeAccountState, MergeAccountResources>): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const windowSize = useWindowSizeValueWithCallbacks();

  useStartSession(
    {
      type: 'callbacks',
      props: () => resources.get().session,
      callbacks: resources.callbacks,
    },
    {
      onStart: () => {
        resources.get().session?.storeAction('open', {
          merge_suggestions: (state.get().mergeSuggestions ?? []).map((s) => s.provider),
        });
      },
    }
  );

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC: windowSize });

  const onCloseClick = useCallback(() => {
    resources.get().session?.storeAction('x', null);

    const s = state.get();
    s.ian?.onShown();
    s.onSuggestionsDismissed();
  }, [resources, state]);

  const onLeavingWith = useCallback(
    (provider: OauthProvider) => {
      resources.get().session?.storeAction('continue_with_provider', { provider });

      const s = state.get();
      s.ian?.onShown();
      s.onSuggestionsDismissed();
    },
    [resources, state]
  );

  const bodyText = useMappedValueWithCallbacks(resources, (r) => {
    const parts = [
      'It looks like you have created an account with us before. Please try logging in again with ',
    ];
    const providers = new Set(
      Object.keys(r.providerUrls ?? {}).filter(
        (k) => !!(r.providerUrls as Record<string, string | null> | null)?.[k]
      )
    );
    const arr = Array.from(providers)
      .sort()
      .map(
        (p) =>
          ({
            Google: 'Google',
            SignInWithApple: 'Apple',
            Direct: 'email',
            Dev: 'dev',
          }[p])
      )
      .filter((p) => p !== undefined) as string[];

    if (arr.length === 0) {
      parts.push('any of the following:');
    } else if (arr.length === 1) {
      parts.push(arr[0]);
    } else if (arr.length === 2) {
      parts.push(arr[0], ' or ', arr[1]);
    } else {
      for (let i = 0; i < arr.length; i++) {
        if (i === arr.length - 1) {
          parts.push(', or ', arr[i]);
        } else if (i === 0) {
          parts.push(arr[i]);
        } else {
          parts.push(', ', arr[i]);
        }
      }
    }
    return parts.join('');
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.background} />
      <div className={styles.contentContainer}>
        <div className={styles.closeButtonContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
        </div>
        <div className={styles.content}>
          <div className={styles.header}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(resources, (r) => r.givenName)}
              component={(name) => (
                <>
                  {name && name !== 'Anonymous' && (
                    <div className={styles.headerLine}>Hi, {name}!</div>
                  )}
                </>
              )}
            />
            <div className={styles.headerLine}>Welcome back.</div>
          </div>
          <RenderGuardedComponent
            props={bodyText}
            component={(txt) => <div className={styles.body}>{txt}</div>}
          />
          <div className={styles.providers}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(resources, (r) => r.providerUrls)}
              component={(urls) => ProviderUrls(onLeavingWith, urls)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ProviderUrls = (
  onLeavingWith: (provider: OauthProvider) => void,
  urls: MergeAccountResources['providerUrls']
): ReactElement => {
  return (
    <ProvidersList
      items={useMemo((): ProvidersListItem[] => {
        if (urls === null) {
          return [];
        }

        const result: ProvidersListItem[] = [];
        if (urls.Google) {
          result.push({
            provider: 'Google',
            onClick: urls.Google,
            onLinkClick: () => onLeavingWith('Google'),
          });
        }
        if (urls.SignInWithApple) {
          result.push({
            provider: 'SignInWithApple',
            onClick: urls.SignInWithApple,
            onLinkClick: () => onLeavingWith('SignInWithApple'),
          });
        }
        if (urls.Direct) {
          result.push({
            provider: 'Direct',
            onClick: urls.Direct,
            onLinkClick: () => onLeavingWith('Direct'),
          });
        }
        if (urls.Dev) {
          result.push({
            provider: 'Dev',
            onClick: urls.Dev,
            onLinkClick: () => onLeavingWith('Dev'),
          });
        }
        return result;
      }, [urls, onLeavingWith])}
    />
  );
};
