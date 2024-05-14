import { CrudFetcherMapper, convertUsingMapper } from '../crud/CrudFetcher';
import { ClientFlowFlags } from './ClientFlowFlags';
import {
  ClientFlowScreen,
  clientFlowScreenKeyMap,
  serializeClientFlowScreen,
} from './client_flow_screens/ClientFlowScreen';

export type ClientFlow = {
  /** Primary stable external row identifier */
  uid: string;

  /** Semantic identifier */
  slug: string;

  /** Human-readable name for the flow, if one has been set */
  name?: string | null;

  /** Human-readable description for the flow, if one has been set */
  description?: string | null;

  /** OpenAPI 3.0.3 schema object describing the client_parameters */
  clientSchema: any;

  /** OpenAPI 3.0.3 schema object describing the server_parameters */
  serverSchema: any;

  /**
   * When triggering this flow:
   * - `true`: remove everything in the users screen queue, then add this flows
   *   screens such that index 0 is at the front of the queue
   * - `false`: prepend this flows screens to the users screen queue such that
   *   index 0 in screens is at the front of the queue, and after the last screen
   *   in this flow is the old front of the queue
   */
  replaces: boolean;

  /**
   * The screens prependend to the users screen queue when this flow is triggered
   */
  screens: ClientFlowScreen[];

  /** The boolean flags, generally related to access */
  flags: ClientFlowFlags | 0;

  /** When this record was created */
  createdAt: Date;
};

export const clientFlowKeyMap: CrudFetcherMapper<ClientFlow> = {
  client_schema: 'clientSchema',
  server_schema: 'serverSchema',
  screens: (_, v) => ({
    key: 'screens',
    value: (v as any[]).map((x) => convertUsingMapper(x, clientFlowScreenKeyMap)),
  }),
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

export const serializeClientFlow = (x: ClientFlow): any => ({
  uid: x.uid,
  slug: x.slug,
  name: x.name,
  description: x.description,
  client_schema: x.clientSchema,
  server_schema: x.serverSchema,
  replaces: x.replaces,
  screens: x.screens.map((x) => serializeClientFlowScreen(x)),
  flags: x.flags,
  created_at: x.createdAt.getTime() / 1000,
});
