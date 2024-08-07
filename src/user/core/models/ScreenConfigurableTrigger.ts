import { convertUsingMapper, CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';

export type ScreenConfigurableTriggerFlowAPI = {
  /**
   * - `flow`: trigger a client flow while popping the screen
   */
  type: 'flow';
  /** The client flow slug to trigger */
  flow: string;
  /** the endpoint to use to trigger the flow or null for the default */
  endpoint: string | null;
  /** the parameters to pass to the flow; null/undefined is treated like an empty object */
  parameters: object | null | undefined;
};

/** Standard pop without a trigger on the standard endpoint */
export type ScreenConfigurableTriggerPopAPI = {
  /**
   * - `pop`: just pop the screen without any trigger
   */
  type: 'pop';

  /** the endpoint to use or null for the default */
  endpoint: string | null;
};

export type ScreenConfigurableTriggerAPI =
  | ScreenConfigurableTriggerFlowAPI
  | ScreenConfigurableTriggerPopAPI;

export type ScreenConfigurableTriggerFlow = Omit<ScreenConfigurableTriggerFlowAPI, 'parameters'> & {
  /** the parameters to pass to the flow; undefined is treated like an empty object */
  parameters: object | null;
};
export const screenConfigurableTriggerFlowMapper: CrudFetcherMapper<
  ScreenConfigurableTriggerFlow
> = (raw) => {
  return {
    ...raw,
    parameters: raw.parameters ?? null,
  };
};

export type ScreenConfigurableTriggerPop = ScreenConfigurableTriggerPopAPI;
export const screenConfigurableTriggerPopMapper: CrudFetcherMapper<ScreenConfigurableTriggerPop> = (
  raw
) => raw;

export type ScreenConfigurableTrigger =
  | ScreenConfigurableTriggerFlow
  | ScreenConfigurableTriggerPop;
export const screenConfigurableTriggerMapper: CrudFetcherMapper<ScreenConfigurableTrigger> = (
  raw
) => {
  if (raw.type === 'flow') {
    return screenConfigurableTriggerFlowMapper(raw);
  } else if (raw.type === 'pop') {
    return screenConfigurableTriggerPopMapper(raw);
  } else {
    console.warn('unknown screen configurable trigger, treating like pop:', raw);
    return { type: 'pop', endpoint: null };
  }
};

export type ScreenConfigurableTriggerTransitioningPreferredAPI =
  | ScreenConfigurableTriggerAPI
  | string
  | null
  | undefined;
export type ScreenConfigurableTriggerTransitioningTemporaryAPI =
  | ScreenConfigurableTriggerAPI
  | null
  | undefined;

/**
 * All triggers moving forward should be specified via ScreenConfigurableTriggerAPI.
 * Previously, they would only have their flow slug configurable, which would be
 * specified as a string.
 *
 * We will migrate these values in a 3-step process:
 * 1. (Baseline): Server only serves the preferred variable in the old format.
 * 2. Add a temporary field to the screen parameters, configured in the new way,
 *    and the server serves both the old format in the preferred variable and the
 *    new format in the temporary variable.
 *
 *    New clients will use the temporary variable, and old clients will use the
 *    preferred variable.
 * 3. Temporary variable is removed and preferred variable is served in the new format.
 *    Clients now use the new format in the preferred variable.
 */
export const convertScreenConfigurableTriggerWithOldVersion = (
  preferred: ScreenConfigurableTriggerTransitioningPreferredAPI,
  temporary: ScreenConfigurableTriggerTransitioningTemporaryAPI
): ScreenConfigurableTrigger => {
  if (preferred !== undefined && typeof preferred === 'object' && preferred !== null) {
    return convertUsingMapper(preferred, screenConfigurableTriggerMapper);
  }
  if (temporary !== null && temporary !== undefined) {
    return convertUsingMapper(temporary, screenConfigurableTriggerMapper);
  }
  if (preferred === null || preferred === undefined) {
    return { type: 'pop', endpoint: null };
  }
  return { type: 'flow', flow: preferred, endpoint: null, parameters: null };
};
