export const isDeepStrictEqual = (a: unknown, b: unknown) => {
  if (a === b) {
    return true;
  }

  if (a === undefined || a === null || b === undefined || b === null) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!isDeepStrictEqual(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      if (!isDeepStrictEqual((a as any)[key], (b as any)[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
};
