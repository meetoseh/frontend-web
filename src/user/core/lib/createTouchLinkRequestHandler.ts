import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { VisitorLoaded } from '../../../shared/hooks/useVisitorValueWithCallbacks';
import { createGetDataFromRefUsingSignal } from '../../../shared/images/createGetDataFromRefUsingSignal';
import { getJwtExpiration } from '../../../shared/lib/getJwtExpiration';
import { RequestHandler } from '../../../shared/requests/RequestHandler';

export type TouchLinkRequestMinimal = {
  code: string;
  user: { userAttributes: { sub: string } } | null;
  visitor: VisitorLoaded | null;
};

/**
 * Describes a request to store a touch link
 */
export type TouchLinkRequest = {
  /** The code in the URL */
  code: string;
  /** The user to track clicking the code, or null if not logged in */
  user: LoginContextValueLoggedIn | null;
  /** The visitor to track clicking the code, or null if not known */
  visitor: VisitorLoaded | null;
};

export type TouchLink = {
  /** The code that was clicked */
  code: string;
  /** The page that the link goes to */
  pageIdentifier: string;
  /** Additional information for formatting the page; depends on the identifier */
  pageExtra: any;
  /**
   * A unique identifier that can be used to add additional information later
   * via /api/1/notifications/post_login or can be used to potentially trigger flows via
   * /api/1/users/me/screens/apply_touch_link (returns screens, so can be used as an
   * endpoint for screen queue state's pop())
   */
  clickUid: string;
  /** The sub of the user we associated with this click */
  userSub: string | null;
  /** The uid of the visitor we associated with this click  */
  visitorUid: string | null;
};

/**
 * Creates a request handler for tracking a link was clicked and determining
 * where it goes
 */
export const createTouchLinkRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<TouchLinkRequestMinimal, TouchLinkRequest, TouchLink> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: TouchLinkRequestMinimal): string =>
  `${ref.code}-${ref.user?.userAttributes?.sub ?? 'null'}-${ref.visitor?.uid ?? 'null'}`;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: TouchLinkRequest, signal): Promise<TouchLink> => {
    const resp = await apiFetch(
      '/api/1/notifications/complete',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...((ref.visitor === null
            ? {}
            : {
                Visitor: ref.visitor.uid,
              }) as Record<string, string>),
        },
        signal,
      },
      ref.user
    );
    if (!resp.ok) {
      throw resp;
    }
    const data: {
      page_identifier: string;
      page_extra: any;
      click_uid: string;
    } = await resp.json();
    return {
      code: ref.code,
      pageIdentifier: data.page_identifier,
      pageExtra: data.page_extra,
      clickUid: data.click_uid,
      userSub: ref.user?.userAttributes?.sub ?? null,
      visitorUid: ref.visitor?.uid ?? null,
    };
  },
});
const compareRefs = (a: TouchLinkRequest, b: TouchLinkRequest): number => {
  if (a.user === null && b.user !== null) {
    return 1;
  }
  if (a.user !== null && b.user === null) {
    return -1;
  }
  if (a.user === null || b.user === null) {
    return 0;
  }
  return getJwtExpiration(b.user.authTokens.idToken) - getJwtExpiration(a.user.authTokens.idToken);
};
