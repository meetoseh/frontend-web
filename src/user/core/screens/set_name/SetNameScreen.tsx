import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { convertTriggerWithExit } from '../../lib/convertTriggerWithExit';
import { OsehScreen } from '../../models/Screen';
import { SetName } from './SetName';
import { SetNameAPIParams, SetNameMappedParams } from './SetNameParams';
import { SetNameResources } from './SetNameResources';

/**
 * An extremely basic screen where the user can configure their name
 */
export const SetNameScreen: OsehScreen<
  'set_name',
  SetNameResources,
  SetNameAPIParams,
  SetNameMappedParams
> = {
  slug: 'set_name',
  paramMapper: (params) => ({
    entrance: params.entrance,
    top: params.top,
    title: params.title,
    message: params.message,
    back:
      params.back === null || params.back === undefined
        ? null
        : {
            ...convertTriggerWithExit(params.back),
            text: params.back.text,
          },
    save: {
      ...convertTriggerWithExit(params.save),
      text: params.save.text,
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <SetName {...props} />,
};
