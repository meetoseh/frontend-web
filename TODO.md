# LoginContext refactoring

Goals:

- Prevent LoginContext from causing top-level react rerenders by
  removing all direct and indirect calls to useState
- Remove `onboard` localStorage key, replace with `onboard` and
  `setOnboard` in `LoginState`, to match the app
- Re-type LoginContextValue to use disjoint union on `state`
- Add helper functions within `login/features/lib` and
  `login/features/hook` to simplify working with LoginContext
- Refactor login-redirect to include a timeout

Subgoals:

- Move window fragment handling from App to LoginProvider
- Refactor ProviderUrls from `MergeAccount.tsx` to use `ProvidersList`
