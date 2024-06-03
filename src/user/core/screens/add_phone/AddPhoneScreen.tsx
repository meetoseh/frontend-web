import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { AddPhone } from './AddPhone';
import { AddPhoneAPIParams, AddPhoneMappedParams } from './AddPhoneParams';
import { AddPhoneResources } from './AddPhoneResources';

/**
 * Allows the user to enter a phone number and click a button to send them
 * a code and go to a flow where they can enter the code.
 */
export const AddPhoneScreen: OsehScreen<
  'add_phone',
  AddPhoneResources,
  AddPhoneAPIParams,
  AddPhoneMappedParams
> = {
  slug: 'add_phone',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <AddPhone {...props} />,
};
