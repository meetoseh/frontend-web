import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { ResolveMergeConflict } from './ResolveMergeConflict';
import {
  ResolveMergeConflictAPIParams,
  ResolveMergeConflictMappedParams,
  oauthMergeConfirmationRequiredDetailsKeyMap,
} from './ResolveMergeConflictParams';
import { ResolveMergeConflictResources } from './ResolveMergeConflictResources';

/**
 * Allows the user to resolve a merge conflict
 */
export const ResolveMergeConflictScreen: OsehScreen<
  'resolve_merge_conflict',
  ResolveMergeConflictResources,
  ResolveMergeConflictAPIParams,
  ResolveMergeConflictMappedParams
> = {
  slug: 'resolve_merge_conflict',
  paramMapper: (params) => ({
    entrance: params.entrance,
    header: params.header,
    message: params.message,
    conflict: convertUsingMapper(params.conflict, oauthMergeConfirmationRequiredDetailsKeyMap),
    cta: {
      text: params.cta.text,
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.cta.trigger,
        params.cta.triggerv75
      ),
      exit: params.cta.exit,
    },
    skip: {
      text: params.skip.text,
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.skip.trigger,
        params.skip.triggerv75
      ),
      exit: params.skip.exit,
    },
    expired: {
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.expired.trigger,
        params.expired.triggerv75
      ),
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <ResolveMergeConflict {...props} />,
};
