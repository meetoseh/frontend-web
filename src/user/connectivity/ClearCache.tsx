import { ReactElement, useEffect } from 'react';

export const ClearCache = (): ReactElement => {
  useEffect(() => {
    localStorage.clear();
    sessionStorage.clear();
  }, []);

  return <div style={{ fontSize: '40px' }}>All clear!</div>;
};
