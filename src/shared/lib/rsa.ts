/** Contains RSA 4096 with public exponent 65537 helpers */

import { base64URLToByteArray, byteArrayToBase64URL } from './colorUtils';
import { MaxWorkPerFrameStaller } from './createMaxWorkPerFrameStaller';
import { NestableProgress } from './createNestableProgress';

const publicExponent = BigInt(65537);
const zero = BigInt(0);
const one = BigInt(1);
const two = BigInt(2);
const pqMinDistance = bigIntPow(two, BigInt(1948));
const minD = bigIntPow(two, BigInt(2048));

export type ExpensiveOperationConfig = {
  progress: NestableProgress;
  staller: MaxWorkPerFrameStaller;
  /**
   * if we expect it will take longer than this duration in milliseconds
   * to finish, raises an error instead
   */
  maxTimeMs: number;
};

export type RSA4096V1PrivateKeyPair = {
  type: 'rsa-4096-v1';
  publicModulusB64URL: string;
  privateExponentB64URL: string;
  hwAccelInfo?: string;
};

export const createRSA4096PrivateKeyPair = async (
  cfg: ExpensiveOperationConfig
): Promise<RSA4096V1PrivateKeyPair> => {
  // This flow is VERY sensitive. Make sure you read backend.oauth.silent.README before
  // modifying this function.

  // For the vast, vast majority of devices, the javascript implementation won't be used
  // (the native implementation will be used instead). However, it's a helpful reference

  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-512',
      },
      true,
      ['encrypt', 'decrypt']
    );
    const extractedPublic = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const extractedPrivate = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicModulus = extractedPublic.n!;
    const privateExponent = extractedPrivate.d!;

    let hwAccelInfo: string | undefined = undefined;
    try {
      hwAccelInfo = byteArrayToBase64URL(
        new TextEncoder().encode(JSON.stringify(extractedPrivate))
      );
    } catch (e) {
      console.log('rsa: failed to get acceleration info for decrypting challenges', e);
    }
    console.log('rsa: successfully accelerated generating key pair');
    return {
      type: 'rsa-4096-v1',
      publicModulusB64URL: byteArrayToBase64URL(base64URLToByteArray(publicModulus)),
      privateExponentB64URL: byteArrayToBase64URL(base64URLToByteArray(privateExponent)),
      hwAccelInfo,
    };
  } catch (e) {
    console.error('failed to use native crypto, falling back to javascript', e);
  }

  let candidatePairCount = 0;
  while (true) {
    candidatePairCount += 1;
    const result = await cfg.progress.withNestedAsync(
      `generate prime pair, attempt ${candidatePairCount}`,
      async (): Promise<RSA4096V1PrivateKeyPair | undefined> => {
        const p = await cfg.progress.withNestedAsync('first prime', () =>
          generateProbablePrime(cfg, () => true, { expectedCandidates: 4000 })
        );
        const q = await cfg.progress.withNestedAsync('second prime', () =>
          generateProbablePrime(
            cfg,
            (qCandidate) => qCandidate < p - pqMinDistance || qCandidate > p + pqMinDistance,
            { expectedCandidates: 4000 }
          )
        );
        const n = p * q;
        const phi = lcm(p - one, q - one);
        const d = modInverse(publicExponent, phi);
        if (d <= minD) {
          return;
        }
        if (d < 0 || d >= phi) {
          throw new Error('invalid modInverse');
        }
        return {
          type: 'rsa-4096-v1',
          publicModulusB64URL: byteArrayToBase64URL(bigIntToBytes(n, 512)),
          privateExponentB64URL: byteArrayToBase64URL(bigIntToBytes(d, 512)),
        };
      }
    );
    if (result !== undefined) {
      return result;
    }
  }
};

export const decryptRSA4096V1 = async (
  privateKey: RSA4096V1PrivateKeyPair,
  encrypted: Uint8Array | number[]
): Promise<Uint8Array> => {
  if (privateKey.hwAccelInfo !== undefined) {
    try {
      const jwk = JSON.parse(
        new TextDecoder().decode(new Uint8Array(base64URLToByteArray(privateKey.hwAccelInfo)))
      );
      const imported = await window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSA-OAEP', hash: 'SHA-512' },
        false,
        ['decrypt']
      );
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        imported,
        new Uint8Array(encrypted)
      );
      const result = new Uint8Array(decrypted);
      console.log('rsa: successfully accelerated decryption');
      return result;
    } catch (e) {
      console.log('rsa: failed to use acceleration info for decrypting challenges', e);
    }
  }

  const n = bytesToBigint(base64URLToByteArray(privateKey.publicModulusB64URL));
  const d = bytesToBigint(base64URLToByteArray(privateKey.privateExponentB64URL));

  const c = bytesToBigint(encrypted); // c = M^e mod n

  let r = bytesToBigint(crypto.getRandomValues(new Uint8Array(512)));
  while (r >= n || gcd(r, n) !== one) {
    r = bytesToBigint(crypto.getRandomValues(new Uint8Array(512)));
  }
  const q = modInverse(r, n);

  const blindedC = c * bigIntPowMod(r, publicExponent, n); // c*(r)^e mod n = M^e * r^e mod n = (M*r)^e mod n
  const blindedM = bigIntPowMod(blindedC, d, n); // (M*r)^(e*d) mod n = M*r mod n
  const M = (blindedM * q) % n; // M*r*r^-1 mod n = M mod n
  const m = await verifyAndStripOAEPPadding(bigIntToBytes(M, 512));
  return m;
};

/** like Uint8Array but when the primary operations are on bits rather than bytes */
export class Bits {
  /** length in _bits_ */
  public readonly length: number;
  /**
   * the underlying data; you usually don't want to access this directly. contains
   * up to 7 unnecessary trailing bits
   */
  public data: Uint8Array;

  constructor(length: number) {
    this.length = length;
    this.data = new Uint8Array(intDiv(length + 7, 8));
  }

  assignFromUint8Array(data: Uint8Array) {
    if (data.length !== this.data.length) {
      throw new Error('length mismatch');
    }
    this.data.set(data);
  }

  asUint8Array(): Uint8Array {
    if (this.length % 8 !== 0) {
      throw new Error('length not a multiple of 8');
    }
    const copy = new Uint8Array(this.data.length);
    copy.set(this.data);
    return copy;
  }

  getBit(i: number): boolean {
    if (i < 0 || i >= this.length) {
      throw new Error('index out of bounds');
    }
    const bitWithinByte = i % 8;
    const byte = (i - bitWithinByte) / 8;
    return (this.data[byte] & (1 << bitWithinByte)) !== 0;
  }

  getBits(start: number, endExcl: number): Bits {
    if (
      start < 0 ||
      start >= this.length ||
      endExcl < 0 ||
      endExcl >= this.length ||
      start > endExcl
    ) {
      throw new Error('index out of bounds');
    }
    const result = new Bits(endExcl - start);
    for (let i = start; i < endExcl; i++) {
      result.setBit(i - start, this.getBit(i));
    }
    return result;
  }

  setBit(i: number, v: boolean) {
    if (i < 0 || i >= this.length) {
      throw new Error('index out of bounds');
    }
    const bitWithinByte = i % 8;
    const byte = (i - bitWithinByte) / 8;
    if (v) {
      this.data[byte] |= 1 << bitWithinByte;
    } else {
      this.data[byte] &= ~(1 << bitWithinByte);
    }
  }

  setBits(start: number, endExcl: number, bits: Bits) {
    if (
      start < 0 ||
      start >= this.length ||
      endExcl < 0 ||
      endExcl >= this.length ||
      start > endExcl
    ) {
      throw new Error('index out of bounds');
    }
    if (endExcl - start !== bits.length) {
      throw new Error('length mismatch');
    }
    for (let i = start; i < endExcl; i++) {
      this.setBit(i, bits.getBit(i - start));
    }
  }

  concat(o: Bits): Bits {
    const result = new Bits(this.length + o.length);
    result.setBits(0, this.length, this);
    result.setBits(this.length, this.length + o.length, o);
    return result;
  }

  concatMany(...others: Bits[]): Bits {
    const sumLength = others.reduce((acc, o) => acc + o.length, this.length);
    const result = new Bits(sumLength);
    result.setBits(0, this.length, this);
    let offset = this.length;
    for (const o of others) {
      result.setBits(offset, offset + o.length, o);
      offset += o.length;
    }
    return result;
  }
}

/** returns a // b - works with bigint as well as number */
export function intDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

const getLabelHash = (() => {
  let resolved: Uint8Array | null = null;
  let promise: Promise<Uint8Array> | null = null;

  return async () => {
    if (resolved !== null) {
      return resolved;
    }

    if (promise !== null) {
      return promise;
    }

    promise = (async () => {
      return new Uint8Array(await crypto.subtle.digest('SHA-512', new Uint8Array(0)));
    })();
    resolved = await promise;
    promise = null;
    return resolved;
  };
})();

export async function verifyAndStripOAEPPadding(padded: Uint8Array): Promise<Uint8Array> {
  if (padded.length !== 512) {
    throw new Error('invalid length');
  }
  if (padded[0] !== 0) {
    throw new Error('invalid padding');
  }

  const maskedSeed = padded.slice(1, 65);
  const maskedDB = padded.slice(65);
  const seedMask = await mgf1(maskedDB, 64);
  const seed = xor(maskedSeed, seedMask);
  const dbMask = await mgf1(seed, 447);
  const db = xor(maskedDB, dbMask);

  const expectedLabel = db.slice(0, 64);
  const labelHash = await getLabelHash();
  if (!constTimeUint8ArrayEquals(expectedLabel, labelHash)) {
    throw new Error('invalid label');
  }

  let offset = 64;
  while (db[offset] === 0) {
    offset++;
    if (offset >= db.length) {
      throw new Error('invalid padding');
    }
  }

  if (db[offset] !== 1) {
    throw new Error('invalid padding');
  }

  const message = db.slice(offset + 1);
  return message;
}

export const xor = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.length !== b.length) {
    throw new Error('length mismatch');
  }
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
};

export const constTimeUint8ArrayEquals = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    throw new Error('length mismatch');
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};

/** Mask generating function 1 */
export async function mgf1(seed: Uint8Array, lengthBytes: number) {
  if (lengthBytes > BigInt(64) * bigIntPow(two, BigInt(32))) {
    throw new Error('mask too long');
  }

  let T = new Uint8Array(0);
  let counter = zero;

  const space = new Uint8Array(seed.length + 4);
  space.set(seed);

  while (true) {
    let C = bigIntToBytes(counter, 4);
    space.set(C, seed.length);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-512', space));

    const newT = new Uint8Array(T.length + hash.length);
    newT.set(T);
    newT.set(hash, T.length);
    T = newT;
    counter += one;

    if (T.length >= lengthBytes) {
      return T.slice(0, lengthBytes);
    }
  }
}

/**
 * Appendix 1: Generate probable prime with 2048 bits satisfying the given criteria.
 * Always verifies that the public exponent is coprime with p-1.
 */
export async function generateProbablePrime(
  cfg: ExpensiveOperationConfig,
  criteria: (n: bigint) => boolean,
  { expectedCandidates }: { expectedCandidates: number }
): Promise<bigint> {
  cfg.progress.nest('candidate 1');
  try {
    await cfg.staller.stall();

    let candidateCount = 0;
    const startedAt = performance.now();
    while (true) {
      if (candidateCount === 10) {
        const elapsed = performance.now() - startedAt;
        const estimatedTimePerCandidate = elapsed / candidateCount;
        const estimatedTotalTime = estimatedTimePerCandidate * expectedCandidates;
        if (estimatedTotalTime > cfg.maxTimeMs) {
          throw new Error(
            `estimating it will take ${estimatedTotalTime}ms  > ${cfg.maxTimeMs}ms to finish`
          );
        }
        console.log(`estimated total time ms: ${estimatedTotalTime}`);
      }

      await cfg.staller.stall();
      candidateCount += 1;
      cfg.progress.replace(`candidate ${candidateCount}`);
      const pBytes = crypto.getRandomValues(new Uint8Array(256));
      pBytes[0] |= 0b11000000;
      pBytes[255] |= 0b00000001;
      const p = bytesToBigint(pBytes);
      if (gcd(p - one, publicExponent) !== one) {
        continue;
      }
      if (!criteria(p)) {
        continue;
      }

      const a = largestIntegerASuchThat2ToADividesN(p - one);
      const m = (p - one) / bigIntPow(two, a);

      let mrTest = 0;
      while (true) {
        await cfg.staller.stall();
        const b = bytesToBigint(crypto.getRandomValues(new Uint8Array(256)));
        if (b <= one || b >= p - one) {
          continue;
        }

        let z = bigIntPowMod(b, m, p);
        if (z === one || z === p - one) {
          mrTest += 1;
          if (mrTest >= 44) {
            return p;
          }
          continue;
        }

        let satisfied = false;
        for (let j = one; j < a; j = j + one) {
          await cfg.staller.stall();
          z = (z * z) % p;
          if (z === p - one) {
            satisfied = true;
            break;
          }
          if (z === one) {
            break;
          }
        }
        if (!satisfied) {
          break;
        }
        mrTest += 1;
        if (mrTest >= 44) {
          return p;
        }
      }
    }
  } finally {
    cfg.progress.pop();
  }
}

export function modInverse(a: bigint, m: bigint): bigint {
  // computes a^-1 mod m using the extended euclidean algorithm
  const coefficients = getBezoutCoefficients(a, m);
  const x = coefficients[0];
  return ((x % m) + m) % m;
}

export function getBezoutCoefficients(a: bigint, b: bigint): [bigint, bigint] {
  let [oldR, r] = [a, b];
  let [oldS, s] = [one, zero];
  let [oldT, t] = [zero, one];

  while (r !== zero) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }

  return [oldS, oldT];
}

export function largestIntegerASuchThat2ToADividesN(n: bigint): bigint {
  let a = zero;
  let nCopy = n;
  while (nCopy % two === zero) {
    a++;
    nCopy /= two;
  }
  return a;
}

export function bigIntPow(base: bigint, exp: bigint): bigint {
  // exponentiation by squaring
  let result = one;
  let currentBase = base;
  let currentExp = exp;
  while (currentExp > zero) {
    if (currentExp % two === one) {
      result *= currentBase;
    }
    currentBase *= currentBase;
    currentExp /= two;
  }
  return result;
}

export function bigIntPowMod(base: bigint, exp: bigint, mod: bigint): bigint {
  // exponentiation by squaring
  let result = one;
  let currentBase = base % mod;
  let currentExp = exp;
  while (currentExp > zero) {
    if (currentExp % two === one) {
      result = (result * currentBase) % mod;
    }
    currentBase = (currentBase * currentBase) % mod;
    currentExp /= two;
  }
  return result;
}

export function bytesToBigint(bytes: Uint8Array | number[]): bigint {
  let str = '0x';
  for (let i = 0; i < bytes.length; i++) {
    str += bytes[i].toString(16).padStart(2, '0');
  }
  return BigInt(str);
}

export function bigIntToBytes(n: bigint, length: number): Uint8Array {
  // encodes n in big-endian unsigned format with the given length
  const bytes = new Uint8Array(length);
  const nStr = n.toString(16);

  if (nStr.length > length * 2) {
    throw new Error('number too large');
  }

  const nStrPadded = nStr.padStart(length * 2, '0');
  const nBytes = nStrPadded.match(/.{1,2}/g);
  if (nBytes === null) {
    throw new Error('unexpected null');
  }
  for (let i = 0; i < nBytes.length; i++) {
    bytes[i] = parseInt(nBytes[i], 16);
  }
  return bytes;
}

export function gcd(a: bigint, b: bigint): bigint {
  while (b !== zero) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  return (a * b) / gcd(a, b);
}
