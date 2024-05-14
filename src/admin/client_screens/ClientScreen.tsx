import { CrudFetcherMapper } from '../crud/CrudFetcher';
import { ClientScreenFlags } from './ClientScreenFlags';

export type ClientScreen = {
  /** Primary stable row identifier */
  uid: string;

  /** Semantic identifier */
  slug: string;

  /** Name for the admin area */
  name: string | null;

  /** Description for the admin area */
  description: string | null;

  /** OpenAPI 3.0.3 schema object describing the screen input parameters */
  screenSchema: unknown;

  /** bitfield for configuring the screen */
  flags: ClientScreenFlags | 0;
};

export const clientScreenKeyMap: CrudFetcherMapper<ClientScreen> = {
  screen_schema: 'screenSchema',
};
