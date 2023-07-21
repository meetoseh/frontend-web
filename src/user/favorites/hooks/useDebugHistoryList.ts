import { useMemo, useRef } from 'react';
import { VariableStrategyProps } from '../../../shared/anim/VariableStrategyProps';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { InfiniteListing, ProceduralInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { MinimalJourney } from '../lib/MinimalJourney';

export const chooseRandomly = Symbol('chooseRandomly');

export type DebugHistoryListOptions = {
  /**
   * If specified, the list has this many items rather than infinitely
   * many items
   */
  numItems?: number;
  /**
   * If specified the items are all favorited (true) or unfavorited (false).
   * If undefined, they are randomly favorited or unfavorited. Can also use
   * the sentinel value "chooseRandomly" instead of undefined. A random
   * function is chosen such that it gives the same result every time for the
   * same index unless unmounted/remounted.
   */
  favorited?: boolean | typeof chooseRandomly | undefined;

  /**
   * If the user has taken all the classes before (true), or not taken any of
   * them (false). If undefined, they are randomly taken or not taken. Can also
   * use the sentinel value "chooseRandomly" instead of undefined. A random
   * function is chosen such that it gives the same result every time for the
   * same index unless unmounted/remounted.
   */
  taken?: boolean | typeof chooseRandomly | undefined;
};

export const useDebugHistoryList = (
  loginContext: VariableStrategyProps<LoginContextValue>,
  visibleHeight: VariableStrategyProps<number>,
  opts?: DebugHistoryListOptions
): InfiniteListing<MinimalJourney> => {
  const numVisibleRef = useRef(
    Math.ceil(
      (visibleHeight.type === 'react-rerender' ? visibleHeight.props : visibleHeight.props()) / 85
    ) * 25
  );
  const reqOpts = useMemo(
    () =>
      ({
        numItems: opts?.numItems,
        favorited: opts?.favorited ?? chooseRandomly,
        taken: opts?.taken ?? chooseRandomly,
      } as const),
    [opts?.numItems, opts?.favorited, opts?.taken]
  );

  const baseDate = useMemo(() => Date.now(), []);

  return useMemo<InfiniteListing<MinimalJourney>>(() => {
    const numVisible = numVisibleRef.current;
    const result = new ProceduralInfiniteListing<MinimalJourney>(
      (index: number) => {
        const gen = createGenerator(index);
        const favorited = chooseBoolean(reqOpts.favorited, gen);
        const taken = chooseBoolean(reqOpts.taken, gen);
        return {
          uid: `uid-${index}`,
          title: `Title ${index}`,
          instructor: {
            name: 'Instructor',
            image: {
              uid: 'oseh_if_y2J1TPz5VhUUsk8I0ofPwg',
              jwt: null,
            },
          },
          lastTakenAt: taken
            ? new Date(baseDate - index * 1000 * 60 * 60 * 8 - gen.nextBits(3) * 1000 * 60 * 60)
            : null,
          likedAt: favorited
            ? new Date(baseDate - index * 1000 * 60 * 60 * 8 - gen.nextBits(3) * 1000 * 60 * 60)
            : null,
        };
      },
      numVisible,
      10,
      500,
      reqOpts.numItems
    );
    result.reset();
    return result;
  }, [reqOpts, baseDate]);
};

const chooseBoolean = (method: boolean | typeof chooseRandomly, gen: PRNG): boolean => {
  if (method === chooseRandomly) {
    return gen.nextBits(1) === 1;
  }
  return method;
};

// taken from Java's random implementation, based on Donald E. Knuth
const multiplier = 0x5deece66d;
const addend = 0xb;
const mask = (1 << 48) - 1;

/**
 * Initializes a seed value from the given value.
 *
 * @param value The value to initialize the seed from
 * @returns A value which is always the same for the same input value,
 *   but for which initializing in a sequence yields a distribution whose
 *   32-bit values appear randomly distributed to an acceptable degree for
 *   non-cryptographic purposes.
 */
const initSeedFromValue = (value: number): number => {
  let seed = (value ^ multiplier) & mask;
  seed = advanceSeed(seed);
  seed = advanceSeed(seed);
  seed = advanceSeed(seed);
  return seed;
};

/**
 * Advances the given seed number to the next one.
 *
 * @param seed The seed to advance
 * @returns The next seed
 */
const advanceSeed = (seed: number): number => {
  return (seed * multiplier + addend) & mask;
};

/**
 * Plucks the given number of bits from the seed value. At most 32
 * bits can be plucked to get a random distribution.
 */
const pluckBitsFromSeed = (seed: number, bits: number): number => {
  return seed >>> (48 - bits);
};

type PRNG = {
  nextBits: (bits: number) => number;
};

/**
 * Creates a generator which generates a sequence of random bits
 * from the given value. Note that this gives the exact same sequence
 * given the same input value, however, the sequence appears to be
 * random to an acceptable degree for non-cryptographic purposes.
 *
 * At most 32 bits should be taken at a time.
 *
 * @param value The value to initialize the generator from
 */
const createGenerator = (value: number): PRNG => {
  let seed = initSeedFromValue(value);
  return {
    nextBits: (bits: number): number => {
      seed = advanceSeed(seed);
      return pluckBitsFromSeed(seed, bits);
    },
  };
};
