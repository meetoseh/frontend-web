import { AnchorHTMLAttributes, PropsWithChildren, ReactElement } from 'react';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';

/**
 * A basic anchor tag, with a callback that fires while the user is being
 * redirected. Generally, you have enough time to send a request but not enough
 * time to wait for a response.
 */
export const TrackableAnchor = ({
  onLinkClick,
  ...props
}: PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    rel: 'noreferrer';
    onLinkClick: () => void;
  }
>): ReactElement => {
  const anchorVWC = useWritableValueWithCallbacks<HTMLAnchorElement | null>(() => null);

  useValueWithCallbacksEffect(anchorVWC, (anchorRaw) => {
    if (anchorRaw === null) {
      return undefined;
    }
    const anchor = anchorRaw;
    anchor.addEventListener('click', onClick, false);
    return () => {
      anchor.removeEventListener('click', onClick, false);
    };

    function onClick() {
      onLinkClick();
    }
  });

  return (
    <a {...props} ref={(r) => setVWC(anchorVWC, r)}>
      {props.children}
    </a>
  );
};
