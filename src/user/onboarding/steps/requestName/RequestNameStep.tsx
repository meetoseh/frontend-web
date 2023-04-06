import { useContext, useEffect, useMemo, useState } from 'react';
import {
  OsehImageProps,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
} from '../../../../shared/OsehImage';
import { OnboardingStep } from '../../models/OnboardingStep';
import { LoginContext } from '../../../../shared/LoginContext';
import { RequestNameState } from './RequestNameState';
import { RequestNameResources } from './RequestNameResources';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { RequestName } from './RequestName';

const backgroundImageUid = 'oseh_if_hH68hcmVBYHanoivLMgstg';

/**
 * Glue code surrounding requesting a users name if we don't know their name.
 */
export const RequestNameStep: OnboardingStep<RequestNameState, RequestNameResources> = {
  identifier: 'requestName',

  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    return {
      givenName: loginContext.userAttributes?.givenName,
    };
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

    return useMemo<RequestNameResources>(
      () => ({
        background,
        loading: background === null || background.loading,
      }),
      [background]
    );
  },

  isRequired: (worldState) => {
    if (worldState.givenName === undefined) {
      return undefined;
    }

    return worldState.givenName === 'Anonymous';
  },

  component: (worldState, resources, doAnticipateState) => (
    <RequestName state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
