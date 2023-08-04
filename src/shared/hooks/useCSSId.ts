import { useMemo } from 'react';

/**
 * Returns a random valid CSS id.
 */
export const useCSSId = () => {
  const id = useMemo(
    () =>
      'id' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
    []
  );
  return id;
};
