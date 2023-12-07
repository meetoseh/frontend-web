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
- Rename `MergeProvider` to `OauthProvider`, move to
  `features/login/lib/OauthProvider.ts`, use everywhere we are referring
  to oauth providers
- Port over `features/login/components/ProvidersList.tsx` from app,
  move instead put in `shared/components/ButtonsWithIconsColumn.tsx`
  and rename to match
- Add `features/login/components/ProvidersList.tsx` which is a convenience
  wrapper around `ButtonsWithIconsColumn.tsx` that uses `OauthProvider` as
  the key and fills in the icon
- Refactor ProviderUrls from `MergeAccount.tsx` to use `ProvidersList`
- Move `getProviderUrl` from `LoginApp.tsx` to
  `features/login/lib/getOauthProviderUrl.ts`, update app to use the same name
  (it's currently using prepareLink)
- Move `useProviderUrlsValueWithCallbacks` to
  `features/login/hooks/useOauthProviderUrlsValueWithCallbacks`, add argument
  for which providers to use, update return type to be compatible with `ProvidersList`
