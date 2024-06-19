import { Channel } from '../lib/Channel';
import { PartialEmailIcon } from './PartialEmailIcon';
import { PartialIconProps } from './PartialIconProps';
import { PartialPhoneIcon } from './PartialPhoneIcon';
import { PartialPushIcon } from './PartialPushIcon';

/**
 * Convenience component that renders the appropriate dynamic icon for a channel
 * passed in via a prop.
 *
 * When placed within an SVG element, the icon is centered at (50, 50) and is
 * sized to fit a 100x100 viewBox.
 */
export const PartialIconForChannel = ({
  channel,
  ...rest
}: PartialIconProps & { channel: Channel }) => {
  if (channel === 'email') {
    return <PartialEmailIcon {...rest} />;
  } else if (channel === 'push') {
    return <PartialPushIcon {...rest} />;
  }
  return <PartialPhoneIcon {...rest} />;
};
