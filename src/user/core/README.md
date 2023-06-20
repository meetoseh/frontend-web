# Core

Features are injected at arbitrary parts of the user experience via the UserApp router.
The injection process is simple: UserApp uses the useFeaturesState hook, and whenever
that hook provides "loading", it shows a spinner, and whenever it provides "required"
it renders the FeaturesRouter.

What we decide to render is based on steps in a strictly-ordered manner. If any
specific feature is required, then features are required and the required step
with the lowest index is shown. If more time is required to determine which feature
to show, then features are loading.

## Privileged Contexts

How browsers provide privileged contexts greatly complicates transitioning between
screens. Specifically, browsers will generally allow a very short time after a
user interaction where javascript can perform more actions than usual - such as
playing audio, starting a video, going fullscreen, etc.

Since we can't control the users internet connection, this privileged context can
be lost while waiting for a response from the server for the result of the user
interaction.

A simple case is the request name form. When the user clicks "Continue" to submit
the form, we have a privileged context that could be used to play audio. However,
by the time if we know if the server accepted their new name, we may have lost
this context.

Most of the time we want to use privileged contexts when mounting a new component,
e.g., an audio screen wants to be mounted in a privileged context so the user
doesn't have to tap the play button.

To accomplish this, we want to determine what component we _will_ go to if the
form submission goes through successfully, and begin to mount that component while
we're still in a privileged context, and then revert everything and go back if the
submission unexpectedly fails.

## Folder Structure

- user/core/hooks
  - General hooks related to features. Does not contain specific step hooks
- user/core/models
  - General models related to features.
- user/core/FeaturesRouter.tsx
  - the primary component exported by the user/core folder

For features,

- user/core/features/{name}/{Name}State.ts
  - Exports the type which can be used to determine if the feature should be rendered
- user/core/features/{name}/{Name}Resources.ts
  - Exports the type which contains everything required to present the feature
- user/core/features/{name}/{Name}Feature.tsx
  - Handles loading the state/resources and gluing them to the component
- user/core/features/{name}/{Name}.tsx
  - The component which is rendered via the state and resources