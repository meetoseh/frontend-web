import { ReactElement } from 'react';

export const Close = ({
  tight,
  width,
  height,
}: {
  tight?: boolean;
  width?: string;
  height?: string;
}): ReactElement => (
  <svg
    width={width ?? (tight ? '24' : '56')}
    height={height ?? (tight ? '24' : '56')}
    viewBox={tight ? '0 0 24 24' : '-16 -16 56 56'}
    fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path
      d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
      fill="white"
    />
  </svg>
);
