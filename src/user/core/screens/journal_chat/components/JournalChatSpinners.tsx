import { useMemo } from 'react';
import { JournalChatState } from '../lib/JournalChatState';
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';
import { InlineOsehSpinner } from '../../../../../shared/components/InlineOsehSpinner';
import { ThinkingDots } from '../../../../../shared/components/ThinkingDots';
import { OsehStyles } from '../../../../../shared/OsehStyles';
import { ContentContainer } from '../../../../../shared/components/ContentContainer';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import styles from './JournalChatSpinners.module.css';

export type JournalChatSpinnersProps = {
  ctx: ScreenContext;
  chat: JournalChatState;
};

/**
 * Renders the spinner for a journal chat state, if one is needed based on the
 * current transient value
 */
export const JournalChatSpinners = ({ ctx, chat }: JournalChatSpinnersProps) => {
  const prefersDetailedSpinners = useMemo(
    () => localStorage.getItem('journalChatDetailedSpinners') === 'true',
    []
  );

  return (
    <>
      {prefersDetailedSpinners && chat.transient?.type === 'thinking-spinner' ? (
        <>
          <VerticalSpacer height={24} flexGrow={1} />
          <ContentContainer contentWidthVWC={ctx.contentWidth}>
            <div className={OsehStyles.layout.row}>
              <InlineOsehSpinner size={{ type: 'react-rerender', props: { width: 40 } }} />
            </div>
          </ContentContainer>
          <VerticalSpacer height={12} />
          <div
            className={combineClasses(
              OsehStyles.typography.body,
              OsehStyles.colors.v4.primary.smoke
            )}>
            {chat.transient.message}
          </div>
          <VerticalSpacer height={4} />
          {chat.transient.detail !== null && (
            <div
              className={combineClasses(
                OsehStyles.typography.detail1,
                OsehStyles.colors.v4.primary.grey
              )}>
              {chat.transient.detail}
            </div>
          )}
          <VerticalSpacer height={24} flexGrow={1} />
        </>
      ) : undefined}
      {prefersDetailedSpinners && chat.transient?.type === 'thinking-bar' ? (
        <>
          <VerticalSpacer height={24} flexGrow={1} />
          <ContentContainer contentWidthVWC={ctx.contentWidth}>
            <div className={OsehStyles.layout.row}>
              <progress
                className={styles.progress}
                value={chat.transient.at}
                max={chat.transient.of}
              />
            </div>
          </ContentContainer>
          <VerticalSpacer height={12} />
          <div
            className={combineClasses(
              OsehStyles.typography.body,
              OsehStyles.colors.v4.primary.smoke
            )}>
            {chat.transient.message}
          </div>
          <VerticalSpacer height={4} />
          {chat.transient.detail !== null && (
            <div
              className={combineClasses(
                OsehStyles.typography.detail1,
                OsehStyles.colors.v4.primary.grey
              )}>
              {chat.transient.detail}
            </div>
          )}
          <VerticalSpacer height={24} flexGrow={1} />
        </>
      ) : undefined}
      {!prefersDetailedSpinners && chat.transient?.type?.startsWith('thinking') ? (
        <>
          <VerticalSpacer height={24} />
          <ThinkingDots />
          <VerticalSpacer height={24} />
        </>
      ) : undefined}
    </>
  );
};
