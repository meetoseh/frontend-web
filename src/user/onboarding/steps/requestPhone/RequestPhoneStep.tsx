import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  OsehImageProps,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
} from '../../../../shared/OsehImage';
import { OnboardingStep } from '../../models/OnboardingStep';
import { LoginContext, LoginContextValue } from '../../../../shared/LoginContext';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { RequestPhoneResources } from './RequestPhoneResources';
import { RequestPhoneState } from './RequestPhoneState';
import { RequestPhone } from './RequestPhone';

const backgroundImageUid = 'oseh_if_hH68hcmVBYHanoivLMgstg';

/**
 * Determines when we last requested a phone number for the user with the given
 * sub on this device.
 */
const getLastRequestAt = (sub: string, variant: 'first' | 'second'): Date | null => {
  const storedValue = localStorage.getItem(`skip-request-phone-${variant}`);
  if (
    storedValue === undefined ||
    storedValue === null ||
    storedValue === '' ||
    storedValue[0] !== '{'
  ) {
    return null;
  }

  try {
    const parsed: { sub?: string; lastRequestAt?: number } = JSON.parse(storedValue);
    if (parsed.sub !== sub || parsed.lastRequestAt === undefined) {
      return null;
    }
    return new Date(parsed.lastRequestAt);
  } catch (e) {
    return null;
  }
};

/**
 * Stores that we requested a phone number for the user with the given sub on
 * this device at the given time.
 */
const setLastRequestAt = (sub: string, lastRequestAt: Date, variant: 'first' | 'second') => {
  localStorage.setItem(
    `skip-request-phone-${variant}`,
    JSON.stringify({
      sub,
      lastRequestAt: lastRequestAt.getTime(),
    })
  );
};

const makeState = (
  loginContext: LoginContextValue,
  lastFirstRequestAt: Date | number | null,
  lastSecondRequestAt: Date | number | null
): Omit<RequestPhoneState, 'onSkip'> => {
  if (typeof lastFirstRequestAt === 'number') {
    lastFirstRequestAt = new Date(lastFirstRequestAt);
  }
  if (typeof lastSecondRequestAt === 'number') {
    lastSecondRequestAt = new Date(lastSecondRequestAt);
  }

  if (loginContext.userAttributes === null) {
    return {
      hasPhoneNumber: undefined,
      sawInitialRequest: undefined,
      sawSecondRequest: undefined,
    };
  }

  return {
    hasPhoneNumber: loginContext.userAttributes.phoneNumber !== null,
    sawInitialRequest:
      lastFirstRequestAt !== null &&
      lastFirstRequestAt.getTime() + 1000 * 60 * 60 * 24 > Date.now(),
    sawSecondRequest:
      lastSecondRequestAt !== null &&
      lastSecondRequestAt.getTime() + 1000 * 60 * 60 * 24 > Date.now(),
  };
};

export const RequestPhoneStep: OnboardingStep<RequestPhoneState, RequestPhoneResources> = {
  identifier: 'requestPhone',

  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const [lastInitialRequestAt, setLastInitialRequestAtState] = useState<number | null>(null);
    const [lastSecondRequestAt, setLastSecondRequestAtState] = useState<number | null>(null);
    const [state, setState] = useState<RequestPhoneState>(() => ({
      ...makeState(loginContext, lastInitialRequestAt, lastSecondRequestAt),
      onSkip: () => {
        throw new Error('not done initializing');
      },
    }));

    useEffect(() => {
      if (loginContext.userAttributes === null) {
        setLastInitialRequestAtState(null);
        setLastSecondRequestAtState(null);
        return;
      }

      setLastInitialRequestAtState(
        getLastRequestAt(loginContext.userAttributes.sub, 'first')?.getTime() ?? null
      );
      setLastSecondRequestAtState(
        getLastRequestAt(loginContext.userAttributes.sub, 'second')?.getTime() ?? null
      );
    }, [loginContext.userAttributes]);

    const stateRef = useRef(state);
    stateRef.current = state;

    const onSkip = useCallback((): RequestPhoneState => {
      if (loginContext.userAttributes === null) {
        return stateRef.current;
      }

      const now = new Date();

      if (!state.sawInitialRequest) {
        setLastRequestAt(loginContext.userAttributes.sub, now, 'first');
        setLastInitialRequestAtState(now.getTime());
        const newState = {
          ...makeState(loginContext, now, lastSecondRequestAt),
          onSkip,
        };
        setState(newState);
        return newState;
      } else {
        setLastRequestAt(loginContext.userAttributes.sub, now, 'second');
        setLastSecondRequestAtState(now.getTime());
        const newState = {
          ...makeState(loginContext, lastInitialRequestAt, now),
          onSkip,
        };
        setState(newState);
        return newState;
      }
    }, [loginContext, lastInitialRequestAt, lastSecondRequestAt, state.sawInitialRequest]);

    useEffect(() => {
      setState({
        ...makeState(loginContext, lastInitialRequestAt, lastSecondRequestAt),
        onSkip,
      });
    }, [loginContext, lastInitialRequestAt, lastSecondRequestAt, onSkip]);

    return state;
  },

  useResources: (worldState, required) => {
    const images = useOsehImageStatesRef({});
    const windowSize = useWindowSize();
    const [background, setBackground] = useState<OsehImageState | null>(null);

    useEffect(() => {
      const oldProps = images.handling.current.get(backgroundImageUid);
      if (!required) {
        if (oldProps !== undefined) {
          images.handling.current.delete(backgroundImageUid);
          images.onHandlingChanged.current.call({
            old: oldProps,
            current: null,
            uid: backgroundImageUid,
          });
        }
        return;
      }

      if (
        oldProps?.displayWidth === windowSize.width &&
        oldProps?.displayHeight === windowSize.height
      ) {
        return;
      }

      const newProps: OsehImageProps = {
        uid: backgroundImageUid,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      };

      images.handling.current.set(backgroundImageUid, newProps);
      images.onHandlingChanged.current.call({
        old: oldProps ?? null,
        current: newProps,
        uid: backgroundImageUid,
      });
    }, [required, windowSize, images]);

    useEffect(() => {
      const background = images.state.current.get(backgroundImageUid);
      setBackground(background ?? null);

      images.onStateChanged.current.add(handleStateChanged);
      return () => {
        images.onStateChanged.current.remove(handleStateChanged);
      };

      function handleStateChanged(e: OsehImageStateChangedEvent) {
        if (e.uid !== backgroundImageUid) {
          return;
        }

        setBackground(e.current);
      }
    }, [images]);

    return useMemo<RequestPhoneResources>(
      () => ({
        background,
        loading: background === null || background.loading,
      }),
      [background]
    );
  },

  isRequired: (worldState, allStates) => {
    if (worldState.hasPhoneNumber === undefined) {
      return undefined;
    }

    if (worldState.hasPhoneNumber) {
      return false;
    }

    if (!worldState.sawInitialRequest) {
      return true;
    }

    return allStates.introspection.sawIntrospection && !worldState.sawSecondRequest;
  },

  component: (worldState, resources, doAnticipateState) => (
    <RequestPhone state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
