import { useContext } from 'react';
import { Feature } from '../../models/Feature';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { RequestNameState } from './RequestNameState';
import { RequestNameResources } from './RequestNameResources';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { RequestName } from './RequestName';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';

const backgroundImageUid = 'oseh_if_hH68hcmVBYHanoivLMgstg';

/**
 * Glue code surrounding requesting a users name if we don't know their name.
 */
export const RequestNameFeature: Feature<RequestNameState, RequestNameResources> = {
  identifier: 'requestName',

  useWorldState: () => {
    const loginContext = useContext(LoginContext);

    const givenName = loginContext.userAttributes?.givenName;
    const result = useWritableValueWithCallbacks<RequestNameState>(() => ({ givenName }));

    if (result.get().givenName !== givenName) {
      result.set({ givenName });
      result.callbacks.call(undefined);
    }

    return result;
  },

  useResources: (worldState, required) => {
    const images = useOsehImageStateRequestHandler({});
    const windowSize = useWindowSizeValueWithCallbacks();
    const backgroundProps = useMappedValuesWithCallbacks(
      [windowSize, required],
      (): OsehImageProps => ({
        uid: required.get() ? backgroundImageUid : null,
        jwt: null,
        displayWidth: windowSize.get().width,
        displayHeight: windowSize.get().height,
        alt: '',
        isPublic: true,
      })
    );
    const background = useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: () => backgroundProps.get(),
        callbacks: backgroundProps.callbacks,
      },
      images
    );

    return useMappedValueWithCallbacks(
      background,
      (): RequestNameResources => ({
        background: background.get(),
        loading: background.get().loading,
      })
    );
  },

  isRequired: (worldState) => {
    if (worldState.givenName === undefined) {
      return undefined;
    }

    return worldState.givenName === 'Anonymous';
  },

  component: (worldState, resources) => <RequestName state={worldState} resources={resources} />,
};
