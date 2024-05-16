import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';

export type ConfirmationAPIParams = {
  /** The header message */
  header: string;

  /** The subheader message */
  message: string;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger?: string | null;
};

export type ConfirmationMappedParams = Omit<ConfirmationAPIParams, 'trigger'> & {
  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: string | null;
  __mapped?: true;
};
