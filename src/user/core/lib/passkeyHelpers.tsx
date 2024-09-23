import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { base64URLToByteArray, byteArrayToBase64URL } from '../../../shared/lib/colorUtils';
import { SCREEN_VERSION } from '../../../shared/lib/screenVersion';
import { VISITOR_SOURCE } from '../../../shared/lib/visitorSource';

/**
 * Converts a jsonified passkey credential creation options object to the
 * corresponding CredentialCreationOptions object. Mostly, this is undoing
 * the b64url steps
 */
export const convertJsonPasskeyCredentialCreationOptions = (
  raw: any
): CredentialCreationOptions => {
  return {
    publicKey: {
      rp: {
        id: raw.rp.id,
        name: raw.rp.name,
      },
      user: {
        id: new Uint8Array(base64URLToByteArray(raw.user.id)),
        name: raw.user.name,
        displayName: raw.user.displayName,
      },
      challenge: new Uint8Array(base64URLToByteArray(raw.challenge)),
      pubKeyCredParams: raw.pubKeyCredParams,
      timeout: raw.timeout,
      excludeCredentials: raw.excludeCredentials?.map(
        (c: any): PublicKeyCredentialDescriptor => ({
          id: new Uint8Array(base64URLToByteArray(c.id)),
          type: c.type,
          transports: c.transports,
        })
      ),
      authenticatorSelection: raw.authenticatorSelection,
      attestation: raw.attestation,
      extensions: raw.extensions,
    },
  };
};

/**
 * Converts a jsonified passkey credential request options object to the
 * corresponding CredentialRequestOptions object.
 * Mostly, this is undoing the b64url steps
 */
export const convertJsonPasskeyCredentialRequestOptions = (raw: any): CredentialRequestOptions => {
  return {
    publicKey: {
      challenge: new Uint8Array(base64URLToByteArray(raw.challenge)),
      timeout: raw.timeout,
      rpId: raw.rpId,
      allowCredentials: raw.allowCredentials?.map(
        (c: any): PublicKeyCredentialDescriptor => ({
          id: new Uint8Array(base64URLToByteArray(c.id)),
          type: c.type,
          transports: c.transports,
        })
      ),
      userVerification: raw.userVerification,
      extensions: raw.extensions,
    },
  };
};

/**
 * Registers a new passkey with the server, associates it with a new Oseh user,
 * and returns the tokens for that new Oseh user.
 */
export const handlePasskeyRegisterForLogin = async (): Promise<{
  idToken: string;
  refreshToken: string | null;
}> => {
  const loginResponse = await handlePasskeyRegister({
    action: 'login',
    user: null,
  });
  if (!loginResponse.ok) {
    throw loginResponse;
  }

  const loginResponseJson: {
    id_token: string;
    refresh_token?: string;
  } = await loginResponse.json();

  return {
    idToken: loginResponseJson.id_token,
    refreshToken: loginResponseJson.refresh_token ?? null,
  };
};

/**
 * Registers a new passkey with the server and returns a merge token to
 * associate it with an existing Oseh user.
 */
export const handlePasskeyRegisterForMerge = async (
  user: LoginContextValueLoggedIn
): Promise<{
  mergeToken: string;
}> => {
  const loginResponse = await handlePasskeyRegister({
    action: 'merge',
    user,
  });
  if (!loginResponse.ok) {
    throw loginResponse;
  }

  const loginResponseJson: {
    merge_token: string;
  } = await loginResponse.json();

  return {
    mergeToken: loginResponseJson.merge_token,
  };
};

/**
 * Authenticates an existing passkey with the server and returns the tokens for
 * the associated Oseh user.
 */
export const handlePasskeyAuthenticateForLogin = async (): Promise<{
  idToken: string;
  refreshToken: string | null;
}> => {
  const loginResponse = await handlePasskeyAuthenticate({
    action: 'login',
    user: null,
  });
  if (!loginResponse.ok) {
    throw loginResponse;
  }

  const loginResponseJson: {
    id_token: string;
    refresh_token?: string;
  } = await loginResponse.json();

  return {
    idToken: loginResponseJson.id_token,
    refreshToken: loginResponseJson.refresh_token ?? null,
  };
};

/**
 * Authenticates an existing passkey with the server and returns a merge token
 * to associate it with an existing Oseh user.
 */
export const handlePasskeyAuthenticateForMerge = async (
  user: LoginContextValueLoggedIn
): Promise<{
  mergeToken: string;
}> => {
  const loginResponse = await handlePasskeyAuthenticate({
    action: 'merge',
    user,
  });
  if (!loginResponse.ok) {
    throw loginResponse;
  }

  const loginResponseJson: {
    merge_token: string;
  } = await loginResponse.json();

  return {
    mergeToken: loginResponseJson.merge_token,
  };
};

/**
 * Registers a new passkey with the server, then optionally associates it with
 * a new Oseh user (if action is 'login'), otherwise, generates a merge token
 * to associate it with an existing Oseh user (if action is 'merge')
 */
export const handlePasskeyRegister = async ({
  user,
  action,
}: {
  user: LoginContextValueLoggedIn | null;
  action: 'merge' | 'login';
}): Promise<Response> => {
  const response = await apiFetch(
    '/api/1/oauth/passkeys/register_begin?platform=' +
      encodeURIComponent(VISITOR_SOURCE) +
      '&version=' +
      encodeURIComponent(SCREEN_VERSION),
    {
      method: 'POST',
    },
    null
  );
  if (!response.ok) {
    throw response;
  }

  const requestJson = await response.json();
  let result: PublicKeyCredential | null;
  try {
    result = (await navigator.credentials.create(
      convertJsonPasskeyCredentialCreationOptions(requestJson)
    )) as PublicKeyCredential | null;
  } catch (e) {
    console.log('passkey registration failed:', e);
    throw new Error('Passkey creation did not succeed');
  }
  if (result === null) {
    throw new Error('Passkey creation was cancelled');
  }

  const resultResponse = result.response as AuthenticatorAttestationResponse;
  const loginResponse = await apiFetch(
    `/api/1/oauth/passkeys/register_${action}_complete?platform=` +
      encodeURIComponent(VISITOR_SOURCE) +
      '&version=' +
      encodeURIComponent(SCREEN_VERSION),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        id_b64url: byteArrayToBase64URL(new Uint8Array(result.rawId)),
        client_data_json_b64url: byteArrayToBase64URL(
          new Uint8Array(resultResponse.clientDataJSON)
        ),
        attestation_object_b64url: byteArrayToBase64URL(
          new Uint8Array(resultResponse.attestationObject)
        ),
        ...(action === 'login' ? { refresh_token_desired: true } : {}),
      }),
    },
    user
  );
  return loginResponse;
};

/**
 * Authenticates an existing passkey with the server, then optionally returns
 * the tokens for the associated Oseh user (if action is 'login'), otherwise,
 * generates a merge token to associate it with an existing Oseh user (if
 * action is 'merge')
 */
export const handlePasskeyAuthenticate = async ({
  user,
  action,
}: {
  user: LoginContextValueLoggedIn | null;
  action: 'merge' | 'login';
}) => {
  const response = await apiFetch(
    '/api/1/oauth/passkeys/authenticate_begin?platform=' +
      encodeURIComponent(VISITOR_SOURCE) +
      '&version=' +
      encodeURIComponent(SCREEN_VERSION),
    {
      method: 'POST',
    },
    null
  );
  if (!response.ok) {
    throw response;
  }

  const requestJson = await response.json();
  let result: PublicKeyCredential | null;
  try {
    result = (await navigator.credentials.get(
      convertJsonPasskeyCredentialRequestOptions(requestJson)
    )) as PublicKeyCredential | null;
  } catch (e) {
    throw new Error('Passkey sign-in did not succeed');
  }

  if (result === null) {
    throw new Error('Passkey sign-in was cancelled');
  }

  const resultResponse = result.response as AuthenticatorAssertionResponse;

  const loginResponse = await apiFetch(
    `/api/1/oauth/passkeys/authenticate_${action}_complete?platform=` +
      encodeURIComponent(VISITOR_SOURCE) +
      '&version=' +
      encodeURIComponent(SCREEN_VERSION),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        id_b64url: byteArrayToBase64URL(new Uint8Array(result.rawId)),
        authenticator_data_b64url: byteArrayToBase64URL(
          new Uint8Array(resultResponse.authenticatorData)
        ),
        client_data_json_b64url: byteArrayToBase64URL(
          new Uint8Array(resultResponse.clientDataJSON)
        ),
        signature_b64url: byteArrayToBase64URL(new Uint8Array(resultResponse.signature)),
        ...(action === 'login' ? { refresh_token_desired: true } : {}),
      }),
    },
    user
  );
  return loginResponse;
};
