# LoginContext refactoring

Goals:

- Prevent LoginContext from causing top-level react rerenders by
  removing all direct and indirect calls to useState
- Remove `onboard` localStorage key, replace with `onboard` and
  `setOnboard` in `LoginState`, to match the app
- Re-type LoginContextValue to use disjoint union on `state`
- Add helper functions within `login/features/lib` and
  `login/features/hook` to simplify working with LoginContext

Subgoals:

- Move window fragment handling from App to LoginProvider
- Refactor LoginApp to avoid react rerender via removing all direct useState's
  - Ideally, LoginApp is extremely short, mostly referencing components from the
    login feature
- Refactor ProviderUrls from `MergeAccount.tsx` to use `ProvidersList`
- Move `getProviderUrl` from `LoginApp.tsx` to
  `features/login/lib/getOauthProviderUrl.ts`, update app to use the same name
  (it's currently using prepareLink)
- Move `useProviderUrlsValueWithCallbacks` to
  `features/login/hooks/useOauthProviderUrlsValueWithCallbacks`, add argument
  for which providers to use, update return type to be compatible with `ProvidersList`
