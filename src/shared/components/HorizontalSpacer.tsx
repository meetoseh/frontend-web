import { ReactElement } from 'react';

/**
 * A basic horizontal spacer. Uses padding instead of just width to
 * avoid being compressed in some situations.
 */
export const HorizontalSpacer = ({
  width,
  maxWidth,
  flexBasis,
  flexGrow,
}: {
  width: number;
  maxWidth?: number;
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
        ...(maxWidth !== undefined ? { maxWidth: `${maxWidth}px` } : {}),
        ...(flexGrow !== undefined ? { flexGrow: `${flexGrow}` } : {}),
        ...(flexBasis !== undefined ? { flexBasis: `${flexBasis}px` } : {}),
      }}
    />
  );
