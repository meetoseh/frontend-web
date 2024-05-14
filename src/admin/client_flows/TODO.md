# client flows admin todo

- crud/ helpers
  - [x] OpenAPISchemaViewer accepts VWC for object, for now just renders it in a pre tag
  - [x] OpenAPISchemaEditor accepts WVWC for object, uses text area for editing
- client screens
  - [x] ClientScreen (the model and keymap)
  - [x] ClientScreenBlock
  - [x] ClientScreenFilterAndSortBlock
  - [x] ClientScreens
  - [x] ClientScreenPicker
  - [x] showClientScreenPicker

for client flows we're going to take everything as readonly with dragging/double click
to edit, like we did for touch points

## client flows

- images
  - [x] ClientFlowImage
  - [x] ClientFlowImageList
  - [x] showClientFlowImageSelector
  - [x] showClientFlowImagePicker
- content
  - [x] ClientFlowContent
  - [x] ClientFlowContentList
  - [x] showClientFlowContentSelector
  - [x] showClientFlowContentPicker
- client_flow_screens
  - [x] ClientFlowScreen
  - [x] showClientFlowScreenEditor (for editing one client flow screen)
    - [x] includes test button
- [x] BigClientFlow PLACEHOLDER
- [x] ClientFlow
- [x] ClientFlowBlock
- [x] ClientFlowFilterAndSortBlock
- [x] ClientFlows MISSING CREATE
- [x] CreateClientFlow
- [x] ClientFlows
- [x] ClientFlowPicker
- [x] showClientFlowPicker
- [x] BigClientFlow
  - [x] includes test button

## users logs have changed

- [ ] move BigUserInappNotifications to end, mark it deprecated in the title
- [ ] ClientScreenActionsLog
- [ ] showClientScreenActions(clientScreenLogUid)
- [ ] ClientScreensLog
- [ ] BigUserClientScreensLog (click to see actions, like currently)

## CORE WORK

this is going to involve an object like "Resources" which will handle
loading everything when given a list of screens. screens will no longer
have their own world state or resources; they will have to take from the
big resources object.

basically, some effect-like function of the form
`ensureResources(resources, parameters): [() => void, ValueWithCallbacks<boolean>]`
on the screen model. the cleanup function is first and if it's ready to show
that screen is second (?)

We won't do it use-like, which will hopefully allow
us to respect rules of hooks this time

- [ ] users/core/models/Screen
- [ ] users/core/hooks/useScreenQueue

### user/core/screens/confirmation

The first simple screen we create for testing; contains title, message, and a button

https://www.figma.com/design/B8RtzaDUCQK6ku4CO4tblE/%F0%9F%AA%A8-Oseh?node-id=4400-8315&t=GrlgmhyDQ6UiUix8-4

- [ ] client
- [ ] backend migration to add screen
- [ ] add minimal client flows using this screen (empty, etc)

### debug queue

/debug-client-screen-queue

similar to how /debug-features worked, but this time is going to show the common
contexts + resources + screens

### image screen

a really simple screen but now with an image

https://www.figma.com/design/B8RtzaDUCQK6ku4CO4tblE/%F0%9F%AA%A8-Oseh?node-id=7590-32870&t=GrlgmhyDQ6UiUix8-4

- [ ] client
- [ ] backend migration to add screen
- [ ] add client flow

### video screen

a video screen

https://www.figma.com/design/B8RtzaDUCQK6ku4CO4tblE/%F0%9F%AA%A8-Oseh?node-id=7574-36457&t=GrlgmhyDQ6UiUix8-4

- [ ] client
- [ ] backend migration to add screen
- [ ] add client flow

### journey class screen
