import { ReactElement, useMemo } from 'react';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { JournalChatState } from '../../journal_chat/lib/JournalChatState';
import styles from './JournalEntryViewJournalCard.module.css';
import { JournalEntryViewJournalCardBackground } from './JournalEntryViewJournalCardBackground';
import { GridContentContainer } from '../../../../../shared/components/GridContentContainer';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';
import { GridFullscreenContainer } from '../../../../../shared/components/GridFullscreenContainer';
import { HorizontalSpacer } from '../../../../../shared/components/HorizontalSpacer';
import { Check } from '../../series_details/icons/Check';

/**
 * Displays a journey card as it would be within a journal entry view
 * (title, instructor, check)
 */
export const JournalEntryViewJournalCard = ({
  uid,
  chat,
  ctx,
}: {
  /** UID of the journey */
  uid: string;
  /** Chat state, so we can try to extract details */
  chat: JournalChatState;
  /** Screen context for sizing and loading */
  ctx: ScreenContext;
}): ReactElement => {
  const details = useMemo(() => {
    for (const part of chat.data) {
      if (part.data.type !== 'textual') {
        continue;
      }

      for (const subPart of part.data.parts) {
        if (subPart.type !== 'journey') {
          continue;
        }

        if (subPart.details.uid === uid) {
          return subPart.details;
        }
      }
    }

    return null;
  }, [chat, uid]);

  const sizeVWC = useMappedValueWithCallbacks(ctx.contentWidth, (width) => ({ width, height: 71 }));

  if (details === null) {
    return <></>;
  }

  return (
    <GridFullscreenContainer windowSizeImmediate={sizeVWC}>
      <JournalEntryViewJournalCardBackground
        uid={details.darkened_background.uid}
        jwt={details.darkened_background.jwt}
        ctx={ctx}
      />
      <GridContentContainer
        gridSizeVWC={sizeVWC}
        contentWidthVWC={ctx.contentWidth}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.row}>
          <HorizontalSpacer width={0} maxWidth={12} flexGrow={1} />
          <div className={styles.titleText}>{details.title}</div>
        </div>
        <VerticalSpacer height={0} flexGrow={1} maxHeight={2} />
        <div className={styles.row}>
          <HorizontalSpacer width={0} maxWidth={12} flexGrow={1} />
          <div className={styles.instructorText}>{details.instructor.name}</div>
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
      </GridContentContainer>
      <GridContentContainer
        gridSizeVWC={sizeVWC}
        contentWidthVWC={ctx.contentWidth}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.row}>
          <HorizontalSpacer width={0} flexGrow={1} />
          <Check />
          <HorizontalSpacer width={0} maxWidth={12} flexGrow={1} />
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
