import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { VerifyPhone } from './VerifyPhone';
import {
  VerifyPhoneAPIParams,
  VerifyPhoneMappedParams,
  verifyPhoneParamsMapper,
} from './VerifyPhoneParams';
import { VerifyPhoneResources } from './VerifyPhoneResources';

/**
 * Allows the user to verify a phone number by providing the 6-digit code
 * texted to it
 */
export const VerifyPhoneScreen: OsehScreen<
  'verify_phone',
  VerifyPhoneResources,
  VerifyPhoneAPIParams,
  VerifyPhoneMappedParams
> = {
  slug: 'verify_phone',
  paramMapper: (params) => convertUsingMapper(params, verifyPhoneParamsMapper),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <VerifyPhone {...props} />,
};
