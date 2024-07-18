/** computes (base ** secret) % prime */
export const powmod = (base: bigint, secret: bigint, prime: bigint): bigint => {
  const one = BigInt(1);
  const two = BigInt(2);

  let x = base;
  let y = secret;
  let p = prime;
  let res = one;

  while (y > 0) {
    if (y % two === one) {
      res *= x;
      res %= p;
    }

    y = y >> one;
    x = (x * x) % p;
  }
  return res;
};
