import { ReactElement } from 'react';

export type TouchPointSelectionStrategy =
  | 'random_with_replacement'
  | 'fixed'
  | 'ordered_resettable';

export const touchPointSelectionStrategies: TouchPointSelectionStrategy[] = [
  'random_with_replacement',
  'fixed',
  'ordered_resettable',
];

export type TouchPointSelectionStrategyInfo = {
  name: () => ReactElement;
  description: () => ReactElement;
};

export const touchPointSelectionStrategyInfo: Record<
  TouchPointSelectionStrategy,
  TouchPointSelectionStrategyInfo
> = {
  random_with_replacement: {
    name: () => <>Random with replacement</>,
    description: () => <p>Each time select message uniformly at random, ignoring priority</p>,
  },
  fixed: {
    name: () => <>Fixed</>,
    description: () => (
      <p>
        For each recipient, sort the list of messages first by priority, then uniformly at random,
        then send in order.
      </p>
    ),
  },
  ordered_resettable: {
    name: () => <>Ordered resettable</>,
    description: () => (
      <>
        <p>
          Sort messages by priority, keeping only the first message in each priority group, and send
          in order.
        </p>
        <p>
          After reaching the end or when a reset is triggered programatically for that recipient,
          start over from the beginning, but this time within each priority group skip the already
          sent messages.
        </p>
        <p>
          For example, if the messages are 1A, 1B, 2A, 2B, 3A, 3B, then the recipient recieves 1A,
          2A, 3A, 1B, 2B, 3B, 1A, 2A, 3A, ...
        </p>
      </>
    ),
  },
};
