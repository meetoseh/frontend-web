class Fernet {
  /** The original key as it is stored */
  readonly key: string;

  /* Signing key, extracted from the key */
  private readonly signingKey: CryptoKey;

  /* Encryption key, extracted from the key */
  private readonly encryptionKey: CryptoKey;

  /** The text encoder we use */
  private readonly textEncoder: TextEncoder;

  /** The text decoder we use */
  private readonly textDecoder: TextDecoder;

  constructor(key: string, signingKey: CryptoKey, encryptionKey: CryptoKey) {
    this.key = key;
    this.signingKey = signingKey;
    this.encryptionKey = encryptionKey;
    this.textEncoder = new TextEncoder();
    this.textDecoder = new TextDecoder();
  }

  /**
   * Uses the symmetric key to encrypt the given message using the Fernet
   * symmetric encryption algorithm: https://github.com/fernet/spec/
   *
   * Fernet includes a 64-bit timestamp field with second-level precision but does
   * not require a specific time to live. We use 2 minutes to protect against
   * replay attacks and to ensure that message ages are not faked. This means you
   * need to ensure the provided time is synchronized with the server (i.e., via
   * getCurrentServerTimeMS) in case the device clock is off.
   *
   * @param messageUtf8 The message to encode, may include any UTF-8 characters.
   * @param timeServerMS The current time in milliseconds since the Unix epoch.
   * @returns The Fernet token as a base64 (url) encoded string.
   */
  async encrypt(messageUtf8: string, timeServerMS: number): Promise<string> {
    const message = this.textEncoder.encode(messageUtf8);
    const timeServerIntegerSeconds = BigInt(Math.floor(timeServerMS / 1000));
    const timeServerBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      timeServerBytes[i] = Number((timeServerIntegerSeconds >> BigInt(8 * (7 - i))) & BigInt(0xff));
    }
    const iv = window.crypto.getRandomValues(new Uint8Array(16));

    const cipherText = await window.crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      this.encryptionKey,
      message
    );

    const basicParts = new Uint8Array(1 + 8 + iv.byteLength + cipherText.byteLength);
    basicParts[0] = 0x80;
    basicParts.set(timeServerBytes, 1);
    basicParts.set(iv, 1 + 8);
    basicParts.set(new Uint8Array(cipherText), 1 + 8 + iv.byteLength);

    const signature = await window.crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      this.signingKey,
      basicParts
    );

    const result = new Uint8Array(basicParts.byteLength + signature.byteLength);
    result.set(basicParts);
    result.set(new Uint8Array(signature), basicParts.byteLength);

    const resultAsBytesString = Array.from(result, (byte) => String.fromCharCode(byte)).join('');
    const resultAsBase64Url = btoa(resultAsBytesString).replace(/\+/g, '-').replace(/\//g, '_');
    return resultAsBase64Url;
  }

  /**
   * Uses the symmetric key to decrypt the given Fernet token using the Fernet
   * symmetric encryption algorithm:
   *
   * Fernet includes a 64-bit timestamp field with second-level precision but does
   * not require a specific time to live. We use 2 minutes to protect against
   * replay attacks and to ensure that message ages are not faked. This means you
   * need to ensure the provided time is synchronized with the server (i.e., via
   * getCurrentServerTimeMS) in case the device clock is off.
   *
   * @param tokenBase64Url The Fernet token as a base64 (url) encoded string.
   * @param timeServerMS The current time in milliseconds since the Unix epoch.
   * @returns The decrypted message as a UTF-8 string.
   */
  async decrypt(tokenBase64Url: string, timeServerMS: number): Promise<string> {
    const tokenBytesString = atob(tokenBase64Url.replace(/-/g, '+').replace(/_/g, '/'));
    const tokenBytes = new Uint8Array(tokenBytesString.length);
    for (let i = 0; i < tokenBytesString.length; i++) {
      tokenBytes[i] = tokenBytesString.charCodeAt(i);
    }

    const signatureBytes = tokenBytes.slice(-32);
    const basicParts = tokenBytes.slice(0, -32);

    if (basicParts[0] !== 0x80) {
      throw new Error('Invalid token version');
    }

    const isValid = await window.crypto.subtle.verify(
      { name: 'HMAC', hash: 'SHA-256' },
      this.signingKey,
      signatureBytes,
      basicParts
    );

    if (!isValid) {
      throw new Error('Invalid token signature');
    }

    const tokenTimeSeconds = basicParts
      .slice(1, 9)
      .reduce((acc, byte) => (acc << BigInt(8)) + BigInt(byte), BigInt(0));
    const currentServerTimeSeconds = BigInt(Math.floor(timeServerMS / 1000));

    if (tokenTimeSeconds < currentServerTimeSeconds - BigInt(120)) {
      throw new Error('Token expired (excessively far in the past)');
    }
    if (tokenTimeSeconds > currentServerTimeSeconds + BigInt(120)) {
      throw new Error('Token from the future (excessively far in the future)');
    }

    const iv = basicParts.slice(9, 25);
    const cipherText = basicParts.slice(25);

    const message = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      this.encryptionKey,
      cipherText
    );

    return this.textDecoder.decode(message);
  }
}

export type { Fernet };

/**
 * Creates a new Fernet instance from the given key, ready for encryption
 * and decryption.
 */
export const createFernet = async (key: string): Promise<Fernet> => {
  const keyDataAsBytesString = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
  const signingKeyAsBytesString = keyDataAsBytesString.slice(0, 16);
  const encryptionKeyAsBytesString = keyDataAsBytesString.slice(16, 32);

  const signingKeyData = new Uint8Array(signingKeyAsBytesString.length);
  for (let i = 0; i < signingKeyAsBytesString.length; i++) {
    signingKeyData[i] = signingKeyAsBytesString.charCodeAt(i);
  }

  const encryptionKeyData = new Uint8Array(encryptionKeyAsBytesString.length);
  for (let i = 0; i < encryptionKeyAsBytesString.length; i++) {
    encryptionKeyData[i] = encryptionKeyAsBytesString.charCodeAt(i);
  }

  const signingKey = await window.crypto.subtle.importKey(
    'raw',
    signingKeyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const encryptionKey = await window.crypto.subtle.importKey(
    'raw',
    encryptionKeyData,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );

  return new Fernet(key, signingKey, encryptionKey);
};
