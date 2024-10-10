import { Fragment, ReactElement, useMemo } from 'react';
import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { JournalEntry } from '../lib/JournalEntry';
import styles from './JournalEntryCard.module.css';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';
import { HorizontalSpacer } from '../../../../../shared/components/HorizontalSpacer';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { JournalEntryViewJournalCard } from '../../journal_chat/components/JournalEntryViewJournalCard';
import { IconButton } from '../../../../../shared/forms/IconButton';
import { Edit } from '../../../../../shared/components/icons/Edit';
import { OsehColors } from '../../../../../shared/OsehColors';
import { TagText } from '../../journal_entry_summary/components/TagText';
import {
  JournalEntryItemDataDataSummaryV1,
  JournalEntryItemTextualPartVoiceNote,
} from '../../journal_chat/lib/JournalChatState';
import { OsehStyles } from '../../../../../shared/OsehStyles';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import { TextPartVoiceNoteComponent } from '../../journal_chat/components/TextPartVoiceNoteComponent';

export type JournalEntryCardProps = {
  /** The journal entry to show */
  journalEntry: ValueWithCallbacks<JournalEntry>;

  /** The handler for when the card is clicked */
  onClick: () => void;

  /** The handler for when the edit button on the card is clicked */
  onEditClick: () => void;

  /** The screen context for resources etc */
  ctx: ScreenContext;
};

type AbridgedInfoVWC = {
  title: string;
  journey: { uid: string } | null;
  reflectionResponse:
    | { type: 'text'; value: string }
    | { type: 'voice'; part: JournalEntryItemTextualPartVoiceNote }
    | null;
  tags: string[];
};

const refreshChat = () => Promise.resolve(undefined);

/**
 * Displays a journal entry card as it would go on the My Journal page
 */
export const JournalEntryCard = ({
  journalEntry,
  onClick,
  onEditClick,
  ctx,
}: JournalEntryCardProps): ReactElement => {
  const cardStyleVWC = useMappedValueWithCallbacks(ctx.contentWidth, (contentWidth) => ({
    width: `${contentWidth}px`,
  }));
  const cardRefVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(cardRefVWC, cardStyleVWC);

  const canonicalDateVWC = useMappedValueWithCallbacks(
    journalEntry,
    (je) => je.payload.canonicalAt,
    {
      outputEqualityFn: (a, b) => a.getTime() === b.getTime(),
    }
  );

  const innerContentWidthVWC = useMappedValueWithCallbacks(ctx.contentWidth, (contentWidth) => {
    return contentWidth - 32 /* padding */ - 2 /* border */;
  });
  const innerScreenContext = useMemo(
    () => ({
      ...ctx,
      contentWidth: innerContentWidthVWC,
    }),
    [ctx, innerContentWidthVWC]
  );

  const abridgedVWC = useMappedValueWithCallbacks(journalEntry, (je): AbridgedInfoVWC | null => {
    let summary: JournalEntryItemDataDataSummaryV1 | null = null;
    let journey: { uid: string } | null = null;
    let reflectionResponse: AbridgedInfoVWC['reflectionResponse'] = null;

    for (const item of je.payload.items) {
      if (item.type === 'summary' && item.data.type === 'summary') {
        summary = item.data;
      } else if (
        item.type === 'ui' &&
        item.data.type === 'ui' &&
        item.data.conceptually.type === 'user_journey'
      ) {
        journey = { uid: item.data.conceptually.journey_uid };
      } else if (
        item.type === 'reflection-response' &&
        item.data.type === 'textual' &&
        item.data.parts.length > 0 &&
        item.data.parts[0].type === 'paragraph'
      ) {
        reflectionResponse = { type: 'text', value: item.data.parts[0].value };
      } else if (
        item.type === 'reflection-response' &&
        item.data.type === 'textual' &&
        item.data.parts.length > 0 &&
        item.data.parts[0].type === 'voice_note'
      ) {
        reflectionResponse = { type: 'voice', part: item.data.parts[0] };
      }
    }

    if (summary !== null) {
      return { title: summary.title, journey, tags: summary.tags, reflectionResponse };
    }

    return null;
  });

  const editableVWC = useMappedValueWithCallbacks(journalEntry, (je): boolean => {
    for (const item of je.payload.items) {
      if (item.type === 'reflection-response') {
        return true;
      }
    }
    return false;
  });

  const editIconButton = (
    <IconButton
      icon={
        <Edit
          icon={{
            height: 18,
          }}
          container={{
            width: 40,
            height: 40,
          }}
          startPadding={{
            x: {
              fixed: 14,
            },
            y: {
              fixed: 14,
            },
          }}
          color={OsehColors.v4.primary.light}
        />
      }
      srOnlyName="Edit"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEditClick();
      }}
    />
  );

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={styles.card}
      style={cardStyleVWC.get()}
      ref={(r) => setVWC(cardRefVWC, r)}>
      <VerticalSpacer height={16} />
      <div className={OsehStyles.layout.row}>
        <HorizontalSpacer width={16} />
        <RenderGuardedComponent
          props={canonicalDateVWC}
          component={(date) => {
            return <div className={styles.dateTimeText}>{date.toLocaleDateString()}</div>;
          }}
        />
        <HorizontalSpacer width={0} flexGrow={1} />
        <RenderGuardedComponent
          props={canonicalDateVWC}
          component={(date) => {
            return (
              <div className={styles.dateTimeText}>
                {date.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            );
          }}
        />
        <HorizontalSpacer width={16} />
      </div>
      <RenderGuardedComponent
        props={abridgedVWC}
        component={(abridged) =>
          abridged === null ? (
            <>
              <VerticalSpacer height={20} />
              <RenderGuardedComponent
                props={journalEntry}
                component={(entry) => {
                  const items: ReactElement[] = [];

                  entry.payload.items.forEach((item) => {
                    if (
                      item.type === 'chat' &&
                      item.display_author === 'self' &&
                      item.data.type === 'textual'
                    ) {
                      for (const subPart of item.data.parts) {
                        if (subPart.type === 'paragraph') {
                          if (items.length > 0) {
                            items.push(<VerticalSpacer height={16} key={items.length} />);
                          }
                          items.push(
                            <div className={OsehStyles.layout.row} key={items.length}>
                              <HorizontalSpacer width={16} />
                              <div
                                className={combineClasses(
                                  OsehStyles.typography.body,
                                  OsehStyles.colors.v4.primary.smoke
                                )}>
                                {subPart.value}
                              </div>
                              <HorizontalSpacer width={16} flexGrow={1} />
                            </div>
                          );
                        } else if (subPart.type === 'voice_note') {
                          if (items.length > 0) {
                            items.push(<VerticalSpacer height={16} key={items.length} />);
                          }
                          items.push(
                            <TextPartVoiceNoteComponent
                              key={items.length}
                              ctx={ctx}
                              refreshChat={refreshChat}
                              part={subPart}
                              fixedHeight
                            />
                          );
                        }
                      }
                      return;
                    } else if (
                      item.type === 'ui' &&
                      item.data.type === 'ui' &&
                      item.data.conceptually.type === 'user_journey'
                    ) {
                      if (items.length > 0) {
                        items.push(<VerticalSpacer height={16} key={items.length} />);
                      }

                      items.push(
                        <div className={OsehStyles.layout.row} key={items.length}>
                          <HorizontalSpacer width={0} flexGrow={1} />
                          <JournalEntryViewJournalCard
                            uid={item.data.conceptually.journey_uid}
                            chat={{
                              uid: entry.uid,
                              integrity: '',
                              data: entry.payload.items,
                              transient: undefined,
                            }}
                            ctx={innerScreenContext}
                          />
                          <HorizontalSpacer width={0} flexGrow={1} />
                        </div>
                      );
                    } else if (
                      item.type === 'reflection-response' &&
                      item.data.type === 'textual'
                    ) {
                      for (const subPart of item.data.parts) {
                        if (subPart.type !== 'paragraph') {
                          continue;
                        }
                        if (items.length > 0) {
                          items.push(<VerticalSpacer height={16} key={items.length} />);
                        }
                        items.push(
                          <div className={OsehStyles.layout.row} key={items.length}>
                            <HorizontalSpacer width={16} />
                            <div
                              className={combineClasses(
                                OsehStyles.typography.body,
                                OsehStyles.colors.v4.primary.smoke
                              )}>
                              {subPart.value}
                            </div>
                            <HorizontalSpacer width={16} flexGrow={1} />
                          </div>
                        );
                      }
                      return;
                    } else if (item.type === 'summary' && item.data.type === 'summary') {
                      if (items.length > 0) {
                        items.push(<VerticalSpacer height={16} key={items.length} />);
                      }
                      items.push(
                        <div className={OsehStyles.layout.row} key={items.length}>
                          <HorizontalSpacer width={16} />
                          <div
                            className={combineClasses(
                              OsehStyles.typography.titleSemibold,
                              OsehStyles.colors.v4.primary.smoke
                            )}>
                            {item.data.title}
                          </div>
                          <HorizontalSpacer width={16} flexGrow={1} />
                        </div>
                      );

                      if (item.data.tags.length > 0) {
                        items.push(
                          <div className={OsehStyles.layout.row} key={items.length}>
                            <HorizontalSpacer width={16} />
                            {item.data.tags.map((tag, i) => (
                              <Fragment key={i}>
                                {i > 0 && <HorizontalSpacer width={16} />}
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
                            <HorizontalSpacer width={16} flexGrow={1} />
                          </div>
                        );
                      }
                    }
                  });

                  return <>{items}</>;
                }}
              />
              <VerticalSpacer height={16} flexGrow={1} />
              <RenderGuardedComponent
                props={editableVWC}
                component={(editable) =>
                  !editable ? (
                    <></>
                  ) : (
                    <div className={OsehStyles.layout.row}>
                      <HorizontalSpacer width={0} flexGrow={1} />
                      {editIconButton}
                      <HorizontalSpacer width={16} />
                    </div>
                  )
                }
              />
              <VerticalSpacer height={16} />
            </>
          ) : (
            <>
              <VerticalSpacer height={20} />
              <div className={OsehStyles.layout.row}>
                <HorizontalSpacer width={16} />
                <div
                  className={combineClasses(
                    OsehStyles.typography.titleSemibold,
                    OsehStyles.colors.v4.primary.smoke
                  )}>
                  {abridged.title}
                </div>
                <HorizontalSpacer width={16} flexGrow={1} />
              </div>
              {abridged.journey !== null && (
                <>
                  <VerticalSpacer height={16} />
                  <div className={OsehStyles.layout.row}>
                    <HorizontalSpacer width={0} flexGrow={1} />
                    <RenderGuardedComponent
                      props={journalEntry}
                      component={(journalEntry) =>
                        abridged === null || abridged.journey === null ? (
                          <></>
                        ) : (
                          <JournalEntryViewJournalCard
                            uid={abridged.journey.uid}
                            chat={{
                              uid: journalEntry.uid,
                              integrity: '',
                              data: journalEntry.payload.items,
                              transient: undefined,
                            }}
                            ctx={innerScreenContext}
                          />
                        )
                      }
                    />
                    <HorizontalSpacer width={0} flexGrow={1} />
                  </div>
                </>
              )}
              <VerticalSpacer height={16} />
              <div className={OsehStyles.layout.row}>
                <HorizontalSpacer width={16} />
                {abridged.reflectionResponse?.type === 'text' ? (
                  <div className={styles.abridgedBody}>{abridged.reflectionResponse.value}</div>
                ) : abridged.reflectionResponse?.type === 'voice' ? (
                  <TextPartVoiceNoteComponent
                    ctx={ctx}
                    refreshChat={refreshChat}
                    part={abridged.reflectionResponse.part}
                    fixedHeight
                  />
                ) : (
                  <></>
                )}
                <HorizontalSpacer width={16} />
              </div>
              <VerticalSpacer height={0} flexGrow={1} />
              <div className={OsehStyles.layout.row}>
                <HorizontalSpacer width={16} />
                <div className={OsehStyles.layout.column}>
                  <VerticalSpacer height={0} flexGrow={1} />
                  <div className={OsehStyles.layout.rowWrap}>
                    {abridged.tags.map((tag, i) => (
                      <Fragment key={i}>
                        {i > 0 && <HorizontalSpacer width={16} />}
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
                  <VerticalSpacer height={0} flexGrow={1} />
                </div>
                <HorizontalSpacer width={0} flexGrow={1} />
                <div className={OsehStyles.layout.column}>
                  <VerticalSpacer height={10} flexGrow={1} />
                  {editIconButton}
                </div>
                <HorizontalSpacer width={16} />
              </div>
              <VerticalSpacer height={16} />
            </>
          )
        }
      />
    </div>
  );
};
