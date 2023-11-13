import { ReactElement } from 'react';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Channel } from './RequestNotificationTimeState';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import styles from './ChannelSelector.module.css';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ChannelIcon } from './ChannelIcon';

/**
 * Renders the specified channels with the given active channel highlighted.
 * Allows tapping on a channel icon to select it, but the selecting is done
 * via the provided callback.
 */
export const ChannelSelector = ({
  current,
  all,
  onTap,
}: {
  current: ValueWithCallbacks<Channel>;
  all: ValueWithCallbacks<Channel[]>;
  onTap: (channel: Channel) => void;
}): ReactElement => {
  return (
    <div className={styles.channels}>
      <RenderGuardedComponent
        props={all}
        component={(channels) => (
          <>
            {channels.map((channel) => (
              <button
                type="button"
                key={channel}
                className={styles.channelButton}
                onClick={(e) => {
                  e.preventDefault();
                  onTap(channel);
                }}>
                <ChannelIconAdapter channel={channel} current={current} />
              </button>
            ))}
          </>
        )}
      />
    </div>
  );
};

const ChannelIconAdapter = ({
  channel,
  current,
}: {
  channel: Channel;
  current: ValueWithCallbacks<Channel>;
}): ReactElement => {
  const active = useMappedValueWithCallbacks(current, (c) => c === channel);
  return <ChannelIcon active={active} channel={channel} />;
};
