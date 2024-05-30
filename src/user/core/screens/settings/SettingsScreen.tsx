import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { Identity } from '../../features/settings/hooks/useIdentities';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { createMappedLoginContextRequest } from '../../lib/createMappedLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { Settings } from './Settings';
import { SettingsAPIParams, SettingsMappedParams, settingsParamsKeyMap } from './SettingsParams';
import { SettingsResources } from './SettingsResources';
import { Entitlement } from './lib/createEntitlementRequestHandler';

/**
 * Allows the user to perform long-tail actions like updating their reminder
 * settings
 */
export const SettingsScreen: OsehScreen<
  'settings',
  SettingsResources,
  SettingsAPIParams,
  SettingsMappedParams
> = {
  slug: 'settings',
  paramMapper: (params) => convertUsingMapper(params, settingsParamsKeyMap),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const getIdentities = () =>
      createLoginContextRequest({ ctx, handler: ctx.resources.identitiesHandler });
    const identitiesRequest = createWritableValueWithCallbacks<RequestResult<Identity[]> | null>(
      null
    );
    const cleanupIdentitiesRequest = createValueWithCallbacksEffect(
      ctx.login.value,
      () => {
        const req = getIdentities();
        setVWC(identitiesRequest, req);
        return () => {
          req.release();
          if (Object.is(identitiesRequest.get(), req)) {
            setVWC(identitiesRequest, null);
          }
        };
      },
      { applyBeforeCancel: true }
    );
    const [identitiesUnwrapped, cleanupIdentitiesUnwrapper] = unwrapRequestResult(
      identitiesRequest,
      (d) => d.data,
      () => null
    );

    const getPro = () =>
      createMappedLoginContextRequest({
        ctx,
        handler: ctx.resources.entitlementsHandler,
        mapper: (user) => ({ user, entitlement: 'pro' }),
      });
    const proRequest = createWritableValueWithCallbacks<RequestResult<Entitlement> | null>(null);
    const cleanupProRequest = createValueWithCallbacksEffect(
      ctx.login.value,
      () => {
        const req = getPro();
        setVWC(proRequest, req);
        return () => {
          req.release();
          if (Object.is(proRequest.get(), req)) {
            setVWC(proRequest, null);
          }
        };
      },
      { applyBeforeCancel: true }
    );
    const [proUnwrapped, cleanupProUnwrapper] = unwrapRequestResult(
      proRequest,
      (d) => d.data,
      () => null
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      identities: identitiesUnwrapped,
      pro: proUnwrapped,
      dispose: () => {
        cleanupIdentitiesRequest();
        cleanupIdentitiesUnwrapper();
        cleanupProRequest();
        cleanupProUnwrapper();
      },
    };
  },
  component: (props) => <Settings {...props} />,
};
