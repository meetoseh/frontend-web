import {
  NetworkResponse,
  UseNetworkResponseOpts,
  useNetworkResponse,
} from '../../../shared/hooks/useNetworkResponse';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { adaptActiveVWCToAbortSignal } from '../../../shared/lib/adaptActiveVWCToAbortSignal';
import { OASPathItem, OASSchema, OpenAPI } from '../../../shared/lib/openapi';

export type EmailTemplateInfo = {
  /** The slug of the template, e.g., sample for /api/3/templates/sample */
  slug: string;

  /** The summary of the template */
  summary: string;

  /** The description for the tmeplate */
  description: string;

  /** The schema for the request body, or undefined if there are no json arguments */
  schema?: OASSchema;

  /** Mostly intended for debugging; the raw information that was processed */
  raw: {
    /** The original path item that was processed */
    path: OASPathItem;
  };
};

export type UseEmailTemplateInfoResult = {
  /** The email templates by slug */
  bySlug: Record<string, EmailTemplateInfo>;
};

/**
 * Fetches the email templates from the openapi spec of the email-templates server
 */
export const useEmailTemplates = ({
  loadPrevented,
}: Pick<UseNetworkResponseOpts, 'loadPrevented'>): ValueWithCallbacks<
  NetworkResponse<UseEmailTemplateInfoResult>
> => {
  return useNetworkResponse(
    (active) =>
      adaptActiveVWCToAbortSignal(
        active,
        async (signal): Promise<UseEmailTemplateInfoResult | null> => {
          const response = await fetch('/api/3/openapi.json', {
            signal,
          });
          if (!response.ok) {
            throw response;
          }

          const openapi = (await response.json()) as OpenAPI;
          if (openapi.paths === undefined) {
            return { bySlug: {} };
          }
          const bySlug: Record<string, EmailTemplateInfo> = {};
          for (const [path, pathItemRaw] of Object.entries(openapi.paths)) {
            if (!path.startsWith('/api/3/templates/')) {
              continue;
            }

            if ('$ref' in pathItemRaw) {
              console.warn('Skipping path described with $ref (unsupported)');
              continue;
            }
            const pathItem = pathItemRaw;
            if (pathItem.post === undefined) {
              continue;
            }
            const post = pathItem.post;
            if (post.tags === undefined || !post.tags.includes('templates')) {
              continue;
            }

            const slug = path.substring('/api/3/templates/'.length);
            let schema: OASSchema | undefined = undefined;
            if (post.requestBody !== undefined) {
              const requestBody = post.requestBody;
              if ('$ref' in requestBody) {
                console.warn('Skipping path where requestBody described with $ref (unsupported)');
                continue;
              }
              if (requestBody.content !== undefined) {
                const jsonBody = requestBody.content['application/json; charset=utf-8'];
                if (jsonBody === undefined) {
                  if (requestBody.required) {
                    console.warn(
                      'Skipping path with required request body that isnt json utf-8 (unsupported)'
                    );
                    continue;
                  }
                } else {
                  schema = jsonBody.schema;
                }
              }
            }

            bySlug[slug] = {
              slug,
              summary: post.summary ?? '(no summary provided)',
              description: post.description ?? '(no description provided)',
              schema,
              raw: { path: pathItem },
            };
          }
          return { bySlug };
        }
      ),
    { loadPrevented }
  );
};
