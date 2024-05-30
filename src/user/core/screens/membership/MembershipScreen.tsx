import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { createMappedLoginContextRequest } from '../../lib/createMappedLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { Entitlement } from '../settings/lib/createEntitlementRequestHandler';
import { Membership } from './Membership';
import { MembershipAPIParams, MembershipMappedParams } from './MembershipParams';
import { MembershipResources } from './MembershipResources';
import { MembershipUrl } from './lib/createManageMembershipUrlRequestHandler';

/**
 * Allows the user to perform long-tail actions like updating their reminder
 * settings
 */
export const MembershipScreen: OsehScreen<
  'membership',
  MembershipResources,
  MembershipAPIParams,
  MembershipMappedParams
> = {
  slug: 'membership',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
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

    const getMembershipUrl = () =>
      createLoginContextRequest({
        ctx,
        handler: ctx.resources.manageMembershipUrlHandler,
      });
    const manageUrlRequest = createWritableValueWithCallbacks<RequestResult<MembershipUrl> | null>(
      null
    );
    const cleanupManageUrlRequest = createValuesWithCallbacksEffect(
      [proUnwrapped, ctx.login.value],
      () => {
        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          setVWC(manageUrlRequest, null);
          return undefined;
        }

        const pro = proUnwrapped.get();
        if (pro?.activeInfo?.platform !== 'stripe') {
          setVWC(manageUrlRequest, null);
          return undefined;
        }

        const req = getMembershipUrl();
        setVWC(manageUrlRequest, req);

        const cleanupReportExpiration = createValueWithCallbacksEffect(req.data, (v) => {
          if (v.type === 'success' && v.data.expiresAt.getTime() < Date.now()) {
            v.reportExpired();
          }
          return undefined;
        });

        return () => {
          cleanupReportExpiration();
          req.release();
          if (Object.is(manageUrlRequest.get(), req)) {
            setVWC(manageUrlRequest, null);
          }
        };
      }
    );
    const [manageUrlUnwrapped, cleanupManageUrlUnwrapper] = unwrapRequestResult(
      manageUrlRequest,
      (d) => ({ url: d.data.url, expiresAt: d.data.expiresAt, reportExpired: d.reportExpired }),
      () => null
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      pro: proUnwrapped,
      manageUrl: manageUrlUnwrapped,
      dispose: () => {
        cleanupProRequest();
        cleanupProUnwrapper();
        cleanupManageUrlRequest();
        cleanupManageUrlUnwrapper();
      },
    };
  },
  component: (props) => <Membership {...props} />,
};
