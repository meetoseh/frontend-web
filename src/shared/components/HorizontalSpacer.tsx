import { ReactElement } from 'react';

/**
 * A basic horizontal spacer. Uses padding instead of just width to
 * avoid being compressed in some situations.
 */
export const HorizontalSpacer = ({
  width,
  flexBasis,
  flexGrow,
}: {
  width: number;
  flexBasis?: number;
  flexGrow?: number;
}): ReactElement =>
  width === 0 && flexGrow === undefined ? (
    <></>
  ) : (
    <div
      style={{
        width: `${width}px`,
        paddingLeft: `${width}px`,
        ...(flexGrow !== undefined ? { flexGrow: `${flexGrow}px` } : {}),
        ...(flexBasis !== undefined ? { flexBasis: `${flexBasis}px` } : {}),
      }}
    />
  );
