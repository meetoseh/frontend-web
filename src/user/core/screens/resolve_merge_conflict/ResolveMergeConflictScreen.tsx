import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
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
    ...params,
    conflict: convertUsingMapper(params.conflict, oauthMergeConfirmationRequiredDetailsKeyMap),
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
