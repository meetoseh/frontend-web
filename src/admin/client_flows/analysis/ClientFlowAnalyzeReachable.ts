import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { convertUsingMapper, CrudFetcherMapper } from '../../crud/CrudFetcher';
import { ClientFlowAnalysisEnvironmentAPI } from './ClientFlowAnalysisEnvironment';

/**
 * The request body request to get the reachable flows from a given source
 */
export type ClientFlowAnalyzeReachableRequestNoTarget = {
  /** The environment that is used to match client flow predicates and thus produce the graph */
  settings: ClientFlowAnalysisEnvironmentAPI;
  /** The slug of the client flow to start the search from */
  source: string;
  target?: null;
  /** True to search the inverted graph, false to search the normal graph */
  inverted: boolean;
  /** If null, paths may be of unlimited length. Otherwise, the maximum number of nodes in the paths */
  max_steps: number | null;
  /** null for the first page, otherwise, the `next_targets_cursor` from the previous page */
  targets_cursor: string | null;
  offset_paths?: undefined;
  limit_paths?: undefined;
};

export type ClientFlowAnalyzeReachableRequestWithTarget = {
  /** The environment that is used to match client flow predicates and thus produce the graph */
  settings: ClientFlowAnalysisEnvironmentAPI;
  /** The slug of the client flow to start the search from */
  source: string;
  /**
   * The specific target you are interested in; the result will contain at most one target,
   * and if it contains one, it will be this one
   */
  target: string;
  /** True to search the inverted graph, false to search the normal graph */
  inverted: boolean;
  /** If null, paths may be of unlimited length. Otherwise, the maximum number of nodes in the paths */
  max_steps: number | null;
  targets_cursor?: undefined;
  /** 0 for the first page, otherwise, the `next_offset` from the previous page */
  offset_paths: number;
  /** the maximum number of paths to return. the backend may return fewer */
  limit_paths: number;
};

export type ClientFlowAnalyzeReachableRequest =
  | ClientFlowAnalyzeReachableRequestNoTarget
  | ClientFlowAnalyzeReachableRequestWithTarget;

export type FlowPathNodeEdgeViaScreenTrigger = {
  /**
   * - `screen-trigger`: this edge was found via the allowed triggers on a screen within
   *   the previous flow, and we were able to find a screen parameter matching this trigger
   *   in the fixed screen parameters
   */
  type: 'screen-trigger';
  /** the index of the screen within the previous flow */
  index: number;
  /** the slug of the screen at this index within the previous flow */
  slug: string;
  /** if a name was set on the screen within the previous flow, the name, otherwise null */
  name: string | null;
  /** the path to the flow_slug trigger in the fixed screen parameters */
  trigger: (string | number)[];
  /** the best description that could be found for when this trigger occurs */
  description: string;
};

export const flowPathNodeViaScreenTriggerMapper: CrudFetcherMapper<
  FlowPathNodeEdgeViaScreenTrigger
> = (raw) => ({
  type: raw.type,
  index: raw.index,
  slug: raw.slug,
  name: raw.name ?? null,
  trigger: raw.trigger,
  description: raw.description,
});

export type FlowPathNodeEdgeViaScreenAllowed = {
  /**
   * - `screen-allowed`: indicates this edge was found via the allowed triggers on a screen
   *   within the previous flow, but we couldn't guess at when it occurs
   */
  type: 'screen-allowed';
  /** the index of the screen within the previous flow */
  index: number;
  /** the slug of the screen at this index in the previous flow */
  slug: string;
  /** the name of the screen at this index in the previous flow, if set, otherwise null */
  name: string | null;
};

export const flowPathNodeViaScreenAllowedMapper: CrudFetcherMapper<
  FlowPathNodeEdgeViaScreenAllowed
> = (raw) => ({
  type: raw.type,
  index: raw.index,
  slug: raw.slug,
  name: raw.name ?? null,
});

export type FlowPathNodeEdgeViaFlowReplacerRule = {
  /**
   * - `flow-replacer-rule`: this edge was found via a flow replacer rule in the previous flow
   */
  type: 'flow-replacer-rule';
  /** the index of the rule within the flow */
  ruleIndex: number;
};

export const flowPathNodeViaFlowReplacerRuleMapper: CrudFetcherMapper<FlowPathNodeEdgeViaFlowReplacerRule> =
  {
    rule_index: 'ruleIndex',
  };

export type FlowPathNodeVia =
  | FlowPathNodeEdgeViaScreenTrigger
  | FlowPathNodeEdgeViaScreenAllowed
  | FlowPathNodeEdgeViaFlowReplacerRule;

export const flowPathNodeViaMapper: CrudFetcherMapper<FlowPathNodeVia> = (raw) => {
  if (raw.type === 'screen-trigger') {
    return convertUsingMapper(raw, flowPathNodeViaScreenTriggerMapper);
  }
  if (raw.type === 'screen-allowed') {
    return convertUsingMapper(raw, flowPathNodeViaScreenAllowedMapper);
  }
  if (raw.type === 'flow-replacer-rule') {
    return convertUsingMapper(raw, flowPathNodeViaFlowReplacerRuleMapper);
  }
  throw new Error(`Unknown type: ${raw}`);
};

export type FlowPathNode = {
  /**
   * - `edge`: an edge in the path. for the first edge, the previous flow is the source.
   *   for all other edges, the previous flow is the target of the previous edge.
   */
  type: 'edge';
  /** how this edge was discovered */
  via: FlowPathNodeVia;
  /** the flow that the previous flow goes to via this edge */
  slug: string;
};

export const flowPathNodeMapper: CrudFetcherMapper<FlowPathNode> = {
  via: (_, raw) => ({ key: 'via', value: convertUsingMapper(raw, flowPathNodeViaMapper) }),
};

export type FlowPath = {
  /**
   * - `path`: a path from one flow to another
   */
  type: 'path';
  /** the nodes in the path */
  nodes: FlowPathNode[];
};

export const flowPathMapper: CrudFetcherMapper<FlowPath> = {
  nodes: (_, raw) => ({
    key: 'nodes',
    value: (raw as any[]).map((item) => convertUsingMapper(item, flowPathNodeMapper)),
  }),
};

export type ClientFlowsAnalyzeReachableResultItem = {
  /** the slug of the source flow in the normal graph */
  source: string;
  /** the slug of the target flow in the normal graph */
  target: string;
  /** this page of paths between the source and the target (in the normal graph). may be empty */
  paths: FlowPath[];
  /** the number of paths skipped before this page */
  offset: number;
  /** if there are potentially more paths, the offset to use to get the next page */
  nextOffset: number | null;
};

export const clientFlowsAnalyzeReachableResultItemMapper: CrudFetcherMapper<
  ClientFlowsAnalyzeReachableResultItem
> = (raw): ClientFlowsAnalyzeReachableResultItem => ({
  source: raw.source,
  target: raw.target,
  paths: (raw.paths as any[]).map((item) => convertUsingMapper(item, flowPathMapper)),
  offset: raw.offset,
  nextOffset: raw.next_offset ?? null,
});

export type ClientFlowAnalyzeReachableResult = {
  /** the paths from the source to target, keyed by the target in the indicated graph (normal or inverted) */
  items: Record<string, ClientFlowsAnalyzeReachableResultItem>;
  /** the `targets_cursor` to use for the next page of targets, if there are more targets, otherwise null */
  nextTargetsCursor: string | null;
};

export const clientFlowAnalyzeReachableResultMapper: CrudFetcherMapper<
  ClientFlowAnalyzeReachableResult
> = (raw) => {
  const result: ClientFlowAnalyzeReachableResult = {
    items: {},
    nextTargetsCursor: raw.next_targets_cursor ?? null,
  };

  for (const key in raw.items) {
    result.items[key] = convertUsingMapper(
      raw.items[key],
      clientFlowsAnalyzeReachableResultItemMapper
    );
  }

  return result;
};

export type ClientFlowAnalyzeReachableResponseSuccess = {
  /**
   * - `success`: the search completed normally
   */
  type: 'success';
  /** The paths that were found */
  result: ClientFlowAnalyzeReachableResult;
};

export type ClientFlowAnalyzeReachableResponseNoPaths = {
  /**
   * - `no-paths`: only returned when the request specified a target; indicates there are
   *   definitely no paths (not even at an earlier offset) between the source
   *   and target. this is often all you care about for automated checks
   */
  type: 'no-paths';
};

export type ClientFlowAnalyzeReachableResponseRatelimited = {
  /**
   * - `ratelimited`: the server shed load, try again after a backoff
   */
  type: 'ratelimited';
};

export type ClientFlowAnalyzeReachableResponse =
  | ClientFlowAnalyzeReachableResponseSuccess
  | ClientFlowAnalyzeReachableResponseNoPaths
  | ClientFlowAnalyzeReachableResponseRatelimited;

/**
 * Wrapper around /api/1/client_flows/analyze_reachable
 *
 * @param request The request body
 * @param user The user
 * @returns the interpreted response
 */
export const clientFlowsAnalyzeReachable = async (
  request: ClientFlowAnalyzeReachableRequest,
  user: LoginContextValueLoggedIn,
  bonusInit?: RequestInit
): Promise<ClientFlowAnalyzeReachableResponse> => {
  const response = await apiFetch(
    '/api/1/client_flows/analyze_reachable',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(request),
      ...bonusInit,
    },
    user
  );
  if (!response.ok) {
    if (response.status === 429) {
      return { type: 'ratelimited' };
    }
    throw response;
  }

  if (response.status === 204) {
    return { type: 'no-paths' };
  }

  const data = await response.json();
  const parsed = convertUsingMapper(data, clientFlowAnalyzeReachableResultMapper);
  return {
    type: 'success',
    result: parsed,
  };
};

/**
 * Updates `into` to include the data from `element`, assuming that `element` contains
 * the next page in into.
 */
export const mergeClientFlowAnalyzeReachableResponses = (
  into: ClientFlowAnalyzeReachableResponseSuccess,
  element: ClientFlowAnalyzeReachableResponseSuccess
): void => {
  for (const key in element.result.items) {
    if (key in into.result.items) {
      into.result.items[key].paths.push(...element.result.items[key].paths);
      into.result.items[key].nextOffset = element.result.items[key].nextOffset;
    } else {
      into.result.items[key] = element.result.items[key];
    }
  }
  into.result.nextTargetsCursor = element.result.nextTargetsCursor;
};

/**
 * Like `clientFlowsAnalyzeReachable`, but automatically paginates through all targets
 */
export const clientFlowsAnalyzeReachableAutoPaginateWithNoTarget = async (
  request: Omit<ClientFlowAnalyzeReachableRequestNoTarget, 'targets_cursor'> & {
    targets_cursor?: undefined;
  },
  user: LoginContextValueLoggedIn,
  bonusInit?: RequestInit
): Promise<ClientFlowAnalyzeReachableResponse> => {
  let result: ClientFlowAnalyzeReachableResponseSuccess | null = null;
  let nextTargetsCursor: string | null = null;
  while (true) {
    const response: Awaited<ReturnType<typeof clientFlowsAnalyzeReachable>> =
      await clientFlowsAnalyzeReachable(
        {
          ...request,
          targets_cursor: nextTargetsCursor,
        },
        user,
        bonusInit
      );
    if (response.type !== 'success') {
      return result ?? response;
    }

    if (result === null) {
      result = response;
    } else {
      mergeClientFlowAnalyzeReachableResponses(result, response);
    }

    nextTargetsCursor = response.result.nextTargetsCursor;
    if (nextTargetsCursor === null) {
      return result;
    }
  }
};

/**
 * Like `clientFlowsAnalyzeReachable`, but automatically paginates through all paths
 */
export const clientFlowsAnalyzeReachableAutoPaginateWithTarget = async (
  request: Omit<ClientFlowAnalyzeReachableRequestWithTarget, 'offset_paths' | 'limit_paths'> & {
    offset_paths?: undefined;
    limit_paths?: undefined;
  },
  user: LoginContextValueLoggedIn,
  bonusInit?: RequestInit
): Promise<ClientFlowAnalyzeReachableResponse> => {
  let result: ClientFlowAnalyzeReachableResponseSuccess | null = null;
  let offsetPaths = 0;
  while (true) {
    const response: Awaited<ReturnType<typeof clientFlowsAnalyzeReachable>> =
      await clientFlowsAnalyzeReachable(
        {
          ...request,
          offset_paths: offsetPaths,
          limit_paths: 10,
        },
        user,
        bonusInit
      );
    if (response.type !== 'success') {
      return result ?? response;
    }
    if (result === null) {
      result = response;
    } else {
      mergeClientFlowAnalyzeReachableResponses(result, response);
    }
    offsetPaths = response.result.items[request.target].nextOffset ?? 0;
    if (offsetPaths === 0) {
      return result;
    }
    console.log('redoing with offsetPaths=', offsetPaths);
  }
};
