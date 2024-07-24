import { convertUsingMapper, CrudFetcherMapper } from '../../crud/CrudFetcher';
import {
  ClientFlowPredicate,
  clientFlowPredicateMapper,
  serializeClientFlowPredicate,
} from './ClientFlowPredicate';

export type ClientFlowEffectReplaceParametersCopy = {
  /**
   * - `copy`: copy the parameters as they were provided to the original flow
   */
  type: 'copy';
};

const clientFlowEffectReplaceParametersCopyMapper: CrudFetcherMapper<ClientFlowEffectReplaceParametersCopy> =
  {};
const serializeClientFlowEffectReplaceParametersCopy = (
  x: ClientFlowEffectReplaceParametersCopy
): any => ({
  type: x.type,
});

export type ClientFlowEffectReplaceParametersOmit = {
  /**
   * - `omit`: replace the parameters with an empty object
   */
  type: 'omit';
};

const clientFlowEffectReplaceParametersOmitMapper: CrudFetcherMapper<ClientFlowEffectReplaceParametersOmit> =
  {};
const serializeClientFlowEffectReplaceParametersOmit = (
  x: ClientFlowEffectReplaceParametersOmit
): any => ({
  type: x.type,
});

export type ClientFlowEffectReplaceParameters =
  | ClientFlowEffectReplaceParametersCopy
  | ClientFlowEffectReplaceParametersOmit;

const clientFlowEffectReplaceParametersMapper: CrudFetcherMapper<
  ClientFlowEffectReplaceParameters
> = (v) => {
  if (v.type === 'copy') {
    return convertUsingMapper(v, clientFlowEffectReplaceParametersCopyMapper);
  }
  if (v.type === 'omit') {
    return convertUsingMapper(v, clientFlowEffectReplaceParametersOmitMapper);
  }
  throw new Error(`Unknown type: ${v}`);
};
const serializeClientFlowEffectReplaceParameters = (x: ClientFlowEffectReplaceParameters): any => {
  if (x.type === 'copy') {
    return serializeClientFlowEffectReplaceParametersCopy(x);
  }
  if (x.type === 'omit') {
    return serializeClientFlowEffectReplaceParametersOmit(x);
  }
  throw new Error(`Unknown type: ${x}`);
};

export type ClientFlowEffectReplace = {
  /**
   * - `replace`: the flow should be replaced with a different flow. Note that this can chain.
   */
  type: 'replace';
  /** the slug of the flow to replace this flow with */
  slug: string;
  /** How to construct the new client parameters */
  clientParameters: ClientFlowEffectReplaceParameters;
  /** How to construct the new server parameters */
  serverParameters: ClientFlowEffectReplaceParameters;
};

const clientFlowEffectReplaceMapper: CrudFetcherMapper<ClientFlowEffectReplace> = {
  client_parameters: (_, v) => ({
    key: 'clientParameters',
    value: convertUsingMapper(v, clientFlowEffectReplaceParametersMapper),
  }),
  server_parameters: (_, v) => ({
    key: 'serverParameters',
    value: convertUsingMapper(v, clientFlowEffectReplaceParametersMapper),
  }),
};
const serializeClientFlowEffectReplace = (x: ClientFlowEffectReplace): any => ({
  type: x.type,
  slug: x.slug,
  client_parameters: serializeClientFlowEffectReplaceParameters(x.clientParameters),
  server_parameters: serializeClientFlowEffectReplaceParameters(x.serverParameters),
});

export type ClientFlowEffectSkip = {
  /**
   * - `skip`: shortcut for replace with skip, omitting parameters
   */
  type: 'skip';
};

const clientFlowEffectSkipMapper: CrudFetcherMapper<ClientFlowEffectSkip> = {};
const serializeClientFlowEffectSkip = (x: ClientFlowEffectSkip): any => ({
  type: x.type,
});

export type ClientFlowEffect = ClientFlowEffectReplace | ClientFlowEffectSkip;

const clientFlowEffectMapper: CrudFetcherMapper<ClientFlowEffect> = (v) => {
  if (v.type === 'replace') {
    return convertUsingMapper(v, clientFlowEffectReplaceMapper);
  }
  if (v.type === 'skip') {
    return convertUsingMapper(v, clientFlowEffectSkipMapper);
  }
  throw new Error(`Unknown type: ${v}`);
};
const serializeClientFlowEffect = (x: ClientFlowEffect): any => {
  if (x.type === 'replace') {
    return serializeClientFlowEffectReplace(x);
  }
  if (x.type === 'skip') {
    return serializeClientFlowEffectSkip(x);
  }
  throw new Error(`Unknown type: ${x}`);
};

export type ClientFlowRule = {
  /** The effect to apply if the condition is met */
  effect: ClientFlowEffect;
  /** The requirement to apply the effect */
  condition: ClientFlowPredicate;
};

export const clientFlowRuleMapper: CrudFetcherMapper<ClientFlowRule> = {
  effect: (_, v) => ({ key: 'effect', value: convertUsingMapper(v, clientFlowEffectMapper) }),
  condition: (_, v) => ({
    key: 'condition',
    value: convertUsingMapper(v, clientFlowPredicateMapper),
  }),
};
export const serializeClientFlowRule = (x: ClientFlowRule): any => ({
  effect: serializeClientFlowEffect(x.effect),
  condition: serializeClientFlowPredicate(x.condition),
});
