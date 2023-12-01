import { ReactElement } from 'react';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { ConfirmMergeAccountState, OauthMergeLoginOption } from '../ConfirmMergeAccountState';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { MergeProvider } from '../../mergeAccount/MergeAccountState';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';

type _LoginOptions = {
  options: OauthMergeLoginOption[];
  showEmails: boolean;
};

export const ListLoginOptions = ({
  resources,
  state,
  onlyMerging,
  nullText,
}: {
  state: ValueWithCallbacks<ConfirmMergeAccountState>;
  resources: ValueWithCallbacks<ConfirmMergeAccountResources>;
  onlyMerging?: boolean;
  nullText?: string;
}): ReactElement => {
  const loginOptions = useMappedValueWithCallbacks(state, (s): _LoginOptions | null => {
    if (s.result === null || s.result === undefined || s.result === false) {
      return null;
    }

    const seenProviders = new Set<MergeProvider>();
    const options: OauthMergeLoginOption[] = [];
    let showEmails = false;

    if (!onlyMerging) {
      for (const opt of s.result.originalLoginOptions) {
        if (seenProviders.has(opt.provider)) {
          showEmails = true;
        }
        seenProviders.add(opt.provider);
        options.push(opt);
      }
    }

    for (const opt of s.result.mergingLoginOptions) {
      if (seenProviders.has(opt.provider)) {
        showEmails = true;
      }
      seenProviders.add(opt.provider);
      options.push(opt);
    }

    return { options, showEmails };
  });

  return (
    <RenderGuardedComponent
      props={loginOptions}
      component={(p) => {
        if (p === null) {
          return <>{nullText ?? 'any of the associated identities'}</>;
        }
        return (
          <>
            {p.options.map((opt, i) => (
              <>
                {i > 0 && (i > 1 || i < p.options.length - 1) && <>, </>}
                {i === 1 && p.options.length === 2 && <> or </>}
                {i > 1 && i === p.options.length - 1 && <>or </>}
                {opt.provider === 'Google' && <>Sign in with Google</>}
                {opt.provider === 'SignInWithApple' && <>Sign in with Apple</>}
                {opt.provider === 'Direct' && <>Sign in with Oseh</>}
                {opt.provider === 'Dev' && <>Sign in with Dev</>}
                {opt.provider !== 'Google' &&
                  opt.provider !== 'SignInWithApple' &&
                  opt.provider !== 'Direct' &&
                  opt.provider !== 'Dev' && <>Sign in with {opt.provider}</>}
                {p.showEmails && opt.email && (
                  <>
                    {' '}
                    (<>{opt.email}</>)
                  </>
                )}
              </>
            ))}
          </>
        );
      }}
    />
  );
};
