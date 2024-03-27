import { useCallback, useContext } from 'react';
import { Feature } from '../../models/Feature';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { RequestNameState } from './RequestNameState';
import { RequestNameResources } from './RequestNameResources';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { RequestName } from './RequestName';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useStaleOsehImageOnSwap } from '../../../../shared/images/useStaleOsehImageOnSwap';

const backgroundImageUid = 'oseh_if_NOA1u2xYanYQlA8rdpPEQQ';

/**
 * Glue code surrounding requesting a users name if we don't know their name.
 */
export const RequestNameFeature: Feature<RequestNameState, RequestNameResources> = {
  identifier: 'requestName',

  useWorldState: () => {
    const loginContextRaw = useContext(LoginContext);

    const givenNameVWC = useMappedValueWithCallbacks(loginContextRaw.value, (loginContextUnch) =>
      loginContextUnch.state !== 'logged-in' ? undefined : loginContextUnch.userAttributes.givenName
    );

    return useMappedValueWithCallbacks(
      givenNameVWC,
      useCallback((givenName) => ({ givenName }), [])
    );
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
        placeholderColor: '#040b17',
      })
    );
    const background = useStaleOsehImageOnSwap(
      useOsehImageStateValueWithCallbacks(
        {
          type: 'callbacks',
          props: () => backgroundProps.get(),
          callbacks: backgroundProps.callbacks,
        },
        images
      )
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
