import {
  PropsWithChildren,
  ReactElement,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSingletonEffect } from '../lib/useSingletonEffect';
import { LoginContext, LoginContextValue } from './LoginContext';
import { Visitor, getUTMFromURL, UTM, useVisitor } from '../hooks/useVisitor';
import { apiFetch } from '../ApiConstants';
import { useLogoutHandler } from '../hooks/useLogoutHandler';

/**
 * A discriminatory union based on 'type': the reason the interests were set.
 */
export type SetInterestReason = {
  /**
   * The reason the interests were set. For UTM, the users interests can
   * be determined based on where they came from, e.g., the ad they clicked
   */
  type: 'utm';
  source: string;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
};
/**
 * A discriminatory union based on 'state': the value provided by the interests
 * context provider. Both users and visitors can have interests associated with
 * them. Upon creating an account, the visitor's interests are lazily copied
 * over to the user. However, to avoid the scenario where a user signs up and
 * no longer sees the tailored content for a short period of time, interests
 * are stored, authoritatively, locally for a short duration.
 */
export type InterestsContextValue =
  | {
      /**
       * The current state of the interests context. If the state is 'loading',
       * the visitor or user may have interests, but we don't know yet.
       */
      state: 'loading';
    }
  | {
      /**
       * The current state of the interests context. If the state is 'loaded',
       * the visitor or user has interests, and they are available in the
       * primaryInterest and interests properties.
       */
      state: 'loaded';
      /**
       * The primary interest for the user, typically used for personalization.
       */
      primaryInterest: string;
      /**
       * All interests that the user has. Always includes the primary interest.
       */
      interests: string[];
      /**
       * Used to set the interests for the user locally and in the backend. This
       * will update the state, store the interests locally, and trigger a
       * network request.
       *
       * @param primaryInterest The users primary interest
       * @param interests All interests of the user, must include the primary interest
       * @returns A promise that resolves when the interests have been updated. The
       *   promise rejects if one of the steps fail, but the local state will be
       *   updated regardless.
       */
      setInterests: (
        primaryInterest: string,
        interests: string[],
        reason: SetInterestReason
      ) => Promise<void>;

      /**
       * Resets all local state related to interests. This should be used exceedingly
       * sparingly; it will automatically be called if the user logs out, which is
       * the only common scenario where this is necessary.
       */
      clearLocallyStoredInterests: () => void;
    }
  | {
      /**
       * The current state of the interests context. If the state is 'unavailable',
       * then either there was a network error fetching interests or the user/visitor has
       * no interests.
       */
      state: 'unavailable';

      /**
       * Used to set the interests for the user locally and in the backend. This
       * will update the state, store the interests locally, and trigger a
       * network request.
       *
       * @param primaryInterest The users primary interest
       * @param interests All interests of the user, must include the primary interest
       * @returns A promise that resolves when the interests have been updated. The
       *   promise rejects if one of the steps fail, but the local state will be
       *   updated regardless.
       */
      setInterests: (
        primaryInterest: string,
        interests: string[],
        reason: SetInterestReason
      ) => void;
    };

const defaultProps: InterestsContextValue = { state: 'loading' } as InterestsContextValue;

/**
 * A React Context which provides, in both logged-in and logged-out scenarios, a
 * store for what interests the user has. The interests consist of slugs which
 * identify particular user groups, such as "sleep" or "anxiety". The users
 * primary interest is extensively used for personalization, including copy,
 * images, journeys, and even functionality.
 *
 * It is critical that all components support the 'unavailable' state, as this
 * is also the evergreen user state - i.e, users for which no more specific
 * bucket can be determined. This would include, for example, organic traffic
 * straight to the signup page.
 */
export const InterestsContext: React.Context<InterestsContextValue> = createContext(defaultProps);

/**
 * The expected props for the InterestsContextProvider component.
 */
type InterestsContextProps = {
  /**
   * The current login context, since interests are associated to
   * users where possible. If the user is logged out, the interests
   * are associated to the visitor instead.
   */
  loginContext: LoginContextValue;

  /**
   * The visitor, which is used if the user is logged out
   */
  visitor: Visitor;
};

const _noSetInterests = () => {
  throw new Error('cannot set interests while interests context is loading');
};

const _noClearInterests = () => {
  throw new Error('cannot clear interests while interests context is loading');
};

/**
 * The state that we store locally about the users interests.
 */
type LocallyStoredInterests = {
  /**
   * The primary interest, which is the most critical for personalization.
   */
  primaryInterest: string;
  /**
   * All interests, including the primary interest
   */
  interests: string[];
  /**
   * True if these interests were set by some action we saw the user take
   * locally, false if they were returned from the backend during a standard
   * read.
   */
  authoritative: boolean;
  /**
   * If set, after this time and up to, but not including, the expiration
   * time, the interests should be reused immediately but refreshed in the
   * background. Specified in milliseconds since the epoch.
   */
  staleAfter: number | null;
  /**
   * The time at which these interests expire, in milliseconds since the epoch.
   * Regardless of authoritative, these interests should be completely ignored
   * after this time.
   */
  expiresAt: number;
};

/**
 * Stores the given interests locally, so that they can be retrieved via
 * fetchLocalInterests. This doesn't handle any caching logic like the
 * expiresAt or staleAfter fields, it just stores the interests.
 */
const storeInterestsLocally = (interests: LocallyStoredInterests) => {
  const serialized = JSON.stringify(interests);
  localStorage.setItem('interests', serialized);
};

/**
 * Deletes any locally stored interests.
 */
const deleteLocalInterests = () => {
  localStorage.removeItem('interests');
};

/**
 * Fetches any locally stored interests, ignoring cache fields like
 * staleAfter and expiresAt. Returns null if there are no locally stored
 * interests.
 */
const fetchLocalInterests = (): LocallyStoredInterests | null => {
  const serialized = localStorage.getItem('interests');
  if (serialized === null) {
    return null;
  }
  try {
    return JSON.parse(serialized);
  } catch (e) {
    console.error('failed to parse locally stored interests', e);
    return null;
  }
};

/**
 * If a particular UTM indicates a specific interest, this will return that
 * interest. Otherwise, it will return null.
 */
const getInterestFromUTM = (utm: UTM): { primaryInterest: string; interests: string[] } | null => {
  if (utm.source === 'oseh.com' && utm.medium === 'referral' && utm.campaign === 'headline') {
    if (utm.content === 'sleep') {
      return { primaryInterest: 'sleep', interests: ['sleep'] };
    } else if (utm.content === 'anxiety' || utm.content === 'therapist') {
      return { primaryInterest: 'anxiety', interests: ['anxiety'] };
    } else if (utm.content === 'mindful') {
      return { primaryInterest: 'mindful', interests: ['mindful'] };
    }
  }
  return null;
};

/**
 * The standard provider for the interests context. This will fetch interests
 * from local storage and/or the backend as appropriate, yielding the loading
 * state until it's been determined that either the frontend should behave as if
 * it's an evergreen user (unavailable), or for specific interests.
 *
 * Note that often time interests can be determined from utm parameters. Due to
 * this, this will also check the current url and potentially update the interests
 * before providing them.
 */
export const InterestsProvider = ({
  loginContext,
  visitor,
  children,
}: PropsWithChildren<InterestsContextProps>): ReactElement => {
  const [baseState, setBaseState] = useState<InterestsContextValue>({ state: 'loading' });

  const setInterests = useCallback(
    async (primaryInterest: string, interests: string[], reason: SetInterestReason) => {
      if (loginContext.state === 'loading') {
        throw new Error('cannot set interests while login context is loading');
      }
      if (visitor.loading) {
        throw new Error('cannot set interests while visitor is loading');
      }

      const response = await apiFetch(
        '/api/1/users/me/interests/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...(visitor.uid === null
              ? {}
              : {
                  Visitor: visitor.uid,
                }),
          },
          body: JSON.stringify({
            reason,
            primary_interest: primaryInterest,
            interests,
            source: 'browser',
          }),
        },
        loginContext
      );

      if (response.ok) {
        const data: { primary_interest: string; interests: string[]; visitor_uid: string } =
          await response.json();
        visitor.setVisitor(data.visitor_uid);

        const nowMS = Date.now();
        storeInterestsLocally({
          primaryInterest: data.primary_interest,
          interests: data.interests,
          authoritative: true,
          staleAfter: nowMS + 1000 * 60 * 60 * 24,
          expiresAt: nowMS + 1000 * 60 * 60 * 24 * 7,
        });
        setBaseState({
          state: 'loaded',
          primaryInterest: data.primary_interest,
          interests: data.interests,
          setInterests: _noSetInterests,
          clearLocallyStoredInterests: _noClearInterests,
        });
      }
    },
    [loginContext, visitor]
  );

  const clearInterests = useCallback(async () => {
    deleteLocalInterests();
    setBaseState({ state: 'unavailable', setInterests: _noSetInterests });
  }, []);

  useLogoutHandler(clearInterests);

  const setInterestsRef = useRef(setInterests);
  setInterestsRef.current = setInterests;
  useSingletonEffect(
    (onDone) => {
      if (baseState.state !== 'loading') {
        onDone();
        return;
      }

      if (loginContext.state === 'loading' || visitor.loading) {
        onDone();
        return;
      }

      const vis = visitor;

      let active = true;
      fetchState();
      return () => {
        active = false;
      };

      async function fetchFromServer(): Promise<LocallyStoredInterests | null> {
        const response = await apiFetch(
          '/api/1/users/me/interests/?source=browser',
          {
            method: 'GET',
            headers:
              vis.uid === null
                ? {}
                : {
                    Visitor: vis.uid,
                  },
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: {
          primary_interest: string | null;
          interests: string[];
          visitor_uid: string;
        } = await response.json();

        vis.setVisitor(data.visitor_uid);

        if (data.primary_interest === null) {
          return null;
        }

        const nowMS = Date.now();
        return {
          primaryInterest: data.primary_interest,
          interests: data.interests,
          authoritative: false,
          staleAfter: nowMS + 1000 * 60 * 10,
          expiresAt: nowMS + 1000 * 60 * 60 * 24 * 7,
        };
      }

      async function fetchStateInner() {
        const utm = getUTMFromURL();
        if (utm !== null) {
          const utmInt = getInterestFromUTM(utm);
          if (utmInt !== null) {
            await setInterestsRef.current(utmInt.primaryInterest, utmInt.interests, {
              type: 'utm',
              ...utm,
            });
            return;
          }
        }

        const nowMS = Date.now();
        const locallyStored = fetchLocalInterests();

        if (locallyStored !== null && locallyStored.expiresAt > nowMS) {
          setBaseState({
            state: 'loaded',
            primaryInterest: locallyStored.primaryInterest,
            interests: locallyStored.interests,
            setInterests: _noSetInterests,
            clearLocallyStoredInterests: _noClearInterests,
          });

          if (locallyStored.staleAfter !== null && locallyStored.staleAfter < nowMS) {
            const serverStored = await fetchFromServer();
            if (serverStored !== null) {
              storeInterestsLocally(serverStored);
            }
          }
          return;
        }

        const serverStored = await fetchFromServer();
        if (serverStored !== null) {
          storeInterestsLocally(serverStored);
          setBaseState({
            state: 'loaded',
            primaryInterest: serverStored.primaryInterest,
            interests: serverStored.interests,
            setInterests: _noSetInterests,
            clearLocallyStoredInterests: _noClearInterests,
          });
          return;
        }

        setBaseState({ state: 'unavailable', setInterests: _noSetInterests });
      }

      async function fetchState() {
        try {
          await fetchStateInner();
        } catch (e) {
          if (active) {
            setBaseState({ state: 'unavailable', setInterests: _noSetInterests });
          }
        } finally {
          onDone();
        }
      }
    },
    [baseState, loginContext, visitor]
  );

  const state = useMemo<InterestsContextValue>(() => {
    if (baseState.state === 'loading') {
      return { state: 'loading' };
    }

    if (baseState.state === 'unavailable') {
      return {
        state: 'unavailable',
        setInterests,
      };
    }

    return {
      state: 'loaded',
      primaryInterest: baseState.primaryInterest,
      interests: baseState.interests,
      setInterests,
      clearLocallyStoredInterests: clearInterests,
    };
  }, [baseState, setInterests, clearInterests]);

  return <InterestsContext.Provider value={state}>{children}</InterestsContext.Provider>;
};

/**
 * An alternative constructor to InterestsProvider which uses useContext to get
 * the login context and useVisitor to get the visitor.
 */
export const InterestsAutoProvider = ({ children }: PropsWithChildren<object>) => {
  const loginContext = useContext(LoginContext);
  const visitor = useVisitor();

  return (
    <InterestsProvider loginContext={loginContext} visitor={visitor}>
      {children}
    </InterestsProvider>
  );
};
