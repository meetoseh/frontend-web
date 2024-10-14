import { Fragment, ReactElement } from 'react';
import { ScreenContext } from '../../../hooks/useScreenContext';
import {
  JournalChatState,
  JournalEntryItemData,
  JournalEntryItemTextualPart,
  JournalEntryItemTextualPartJourney,
} from '../lib/JournalChatState';
import styles from './JournalChatParts.module.css';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';
import { OsehStyles } from '../../../../../shared/OsehStyles';
import { HorizontalSpacer } from '../../../../../shared/components/HorizontalSpacer';
import { TagText } from '../../journal_entry_summary/components/TagText';
import { JournalChatJourneyCard } from './JournalChatJourneyCard';
import { TextPartVoiceNoteComponent } from './TextPartVoiceNoteComponent';
import { ContentContainer } from '../../../../../shared/components/ContentContainer';
import { JournalEntryViewJournalCard } from './JournalEntryViewJournalCard';

export type JournalChatPartsProps = {
  /** The general screen context for e.g. the content width and login context */
  ctx: ScreenContext;
  /**
   * A function which can be used to try and get a newer chat reference. Return
   * null if the chat is no longer needed, undefined if it is needed but an
   * error occurred.
   */
  refreshChat: () => Promise<JournalChatState | null | undefined>;
  /**
   * The current journal chat state
   */
  chat: JournalChatState;
  /**
   * Called if the user clicks on one of the journey buttons
   */
  onGotoJourney: (
    part: JournalEntryItemTextualPartJourney,
    partIndex: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;

  /** If specified, if the part doesn't pass this predicate (via return true), it is skipped */
  partFilter?: (part: JournalEntryItemData, partIndex: number) => boolean;

  /**
   * If specified, if the subpart doesn't pass this predicate (via return true), it is skipped
   */
  textualSubPartFilter?: (
    part: JournalEntryItemData,
    partIndex: number,
    subpart: JournalEntryItemTextualPart,
    subpartIndex: number
  ) => boolean;
};

/**
 * Renders the messages within a journal chat.
 */
export const JournalChatParts = ({
  ctx,
  refreshChat,
  chat,
  onGotoJourney,
  partFilter,
  textualSubPartFilter,
}: JournalChatPartsProps) => {
  let parts: ReactElement[] = [];
  chat.data.forEach((part, partIndex) => {
    if (partFilter !== undefined && !partFilter(part, partIndex)) {
      return;
    }

    let subparts: ReactElement[] = [];
    if (part.data.type === 'summary') {
      subparts.push(
        <Fragment key={subparts.length}>
          <div
            className={combineClasses(
              OsehStyles.typography.titleSemibold,
              OsehStyles.colors.v4.primary.light
            )}>
            {part.data.title}
          </div>
          <VerticalSpacer height={4} />
          <div className={OsehStyles.layout.rowWrap}>
            {part.data.tags.map((tag, tagIndex) => (
              <Fragment key={tagIndex}>
                {tagIndex > 0 && <HorizontalSpacer width={16} />}
                <div className={OsehStyles.layout.column}>
                  <VerticalSpacer height={16} />
                  <div className={styles.tag}>
                    <div className={OsehStyles.layout.column}>
                      <VerticalSpacer height={5} />
                      <div className={OsehStyles.layout.row}>
                        <HorizontalSpacer width={8} />
                        <TagText tag={tag} />
                        <HorizontalSpacer width={8} />
                      </div>
                      <VerticalSpacer height={5} />
                    </div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </Fragment>
      );
    } else if (part.data.type === 'textual') {
      part.data.parts.forEach((subPart, subPartIndex) => {
        const realPart = ((key) => {
          if (
            textualSubPartFilter !== undefined &&
            !textualSubPartFilter(part, partIndex, subPart, subPartIndex)
          ) {
            return undefined;
          }

          if (subPart.type === 'paragraph') {
            return (
              <div
                key={key}
                className={combineClasses(
                  part.display_author === 'self' || (part.type === 'chat' && partIndex !== 0)
                    ? OsehStyles.typography.body
                    : OsehStyles.typography.titleSemibold,
                  OsehStyles.colors.v4.primary.light
                )}>
                {subPart.value}
              </div>
            );
          } else if (subPart.type === 'journey') {
            return (
              <button
                type="button"
                key={key}
                className={OsehStyles.unstyling.buttonAsColumn}
                onClick={(e) => onGotoJourney(subPart, partIndex, e)}>
                <JournalChatJourneyCard ctx={ctx} journeyPart={subPart} />
              </button>
            );
          } else if (subPart.type === 'voice_note') {
            return (
              <TextPartVoiceNoteComponent
                key={key}
                ctx={ctx}
                refreshChat={refreshChat}
                part={subPart}
              />
            );
          }
        })(`${subparts.length}-${subPartIndex}`);
        if (realPart === undefined) {
          return;
        }
        if (subparts.length > 0) {
          subparts.push(<VerticalSpacer key={subparts.length} height={16} />);
        }
        subparts.push(realPart);
      });
    } else if (part.data.type === 'ui' && part.data.conceptually.type === 'user_journey') {
      subparts.push(
        <ContentContainer key={subparts.length} contentWidthVWC={ctx.contentWidth}>
          <JournalEntryViewJournalCard
            uid={part.data.conceptually.journey_uid}
            chat={chat}
            ctx={ctx}
          />
        </ContentContainer>
      );
    }

    if (subparts.length > 0) {
      if (parts.length > 0) {
        parts.push(<VerticalSpacer key={parts.length} height={16} />);
      }

      const partClassnames: string[] = [];
      if (part.type === 'chat') {
        partClassnames.push(styles.type__chat);
      } else if (part.type === 'reflection-question') {
        partClassnames.push(styles.type__reflectionQuestion);
      } else if (part.type === 'reflection-response') {
        partClassnames.push(styles.type__reflectionResponse);
      } else if (part.type === 'summary') {
        partClassnames.push(styles.type__summary);
      } else if (part.type === 'ui') {
        partClassnames.push(styles.type__ui);
      }

      if (part.display_author === 'self') {
        partClassnames.push(styles.author__self);
      } else if (part.display_author === 'other') {
        partClassnames.push(styles.author__other);
      }
      parts.push(
        <div key={parts.length} className={combineClasses(...partClassnames)}>
          {subparts}
        </div>
      );
    }
  });
  return <>{parts}</>;
};
