import { HorizontalSpacer } from '../../../../../shared/components/HorizontalSpacer';
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import { OsehStyles } from '../../../../../shared/OsehStyles';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { Arrow } from '../icons/Arrow';
import { JournalEntryItemTextualPartJourney } from '../lib/JournalChatState';
import { JourneyCardTopBackgroundImage } from './JournalCardTopBackgroundImage';
import styles from './JournalChatJourneyCard.module.css';

export type JournalChatJourneyCardProps = {
  ctx: ScreenContext;
  journeyPart: JournalEntryItemTextualPartJourney;
};

/**
 * Renders a card for a journey within a journal chat. This looks clickable,
 * and should generally be wrapped in a button.
 */
export const JournalChatJourneyCard = (props: JournalChatJourneyCardProps) => {
  return (
    <div className={OsehStyles.layout.column}>
      <div className={OsehStyles.layout.stacking.container} style={{ height: '120px' }}>
        <div
          className={combineClasses(
            OsehStyles.layout.stacking.child,
            OsehStyles.layout.stacking.container,
            styles.topBackground
          )}>
          <JourneyCardTopBackgroundImage
            uid={props.journeyPart.details.darkened_background.uid}
            jwt={props.journeyPart.details.darkened_background.jwt}
            ctx={props.ctx}
          />
        </div>
        <div className={combineClasses(OsehStyles.layout.stacking.child, OsehStyles.layout.column)}>
          {props.journeyPart.details.access === 'paid-requires-upgrade' && (
            <>
              <VerticalSpacer height={0} maxHeight={16} flexGrow={1} />
              <div className={OsehStyles.layout.row}>
                <HorizontalSpacer width={16} />
                <div className={styles.topForegroundPaid}>
                  <div
                    className={combineClasses(
                      OsehStyles.typography.detail1,
                      OsehStyles.colors.v4.primary.light
                    )}>
                    Free Trial
                  </div>
                </div>
              </div>
            </>
          )}
          <VerticalSpacer height={0} flexGrow={1} />
          <div className={OsehStyles.layout.row}>
            <HorizontalSpacer width={16} />
            <div
              className={combineClasses(
                OsehStyles.typography.title,
                OsehStyles.colors.v4.primary.light
              )}>
              {props.journeyPart.details.title}
            </div>
          </div>
          <VerticalSpacer height={2} />
          <div className={OsehStyles.layout.row}>
            <HorizontalSpacer width={16} />
            <div
              className={combineClasses(
                OsehStyles.typography.detail1,
                OsehStyles.colors.v4.primary.light
              )}>
              {props.journeyPart.details.instructor.name}
            </div>
          </div>
          <VerticalSpacer height={16} />
        </div>
      </div>
      <div className={combineClasses(styles.bottom, OsehStyles.layout.row)}>
        <div
          className={combineClasses(
            OsehStyles.typography.detail1,
            OsehStyles.colors.v4.primary.grey
          )}>
          {(() => {
            const inSeconds = props.journeyPart.details.duration_seconds;
            const minutes = Math.floor(inSeconds / 60);
            const seconds = Math.floor(inSeconds) % 60;

            return (
              <>
                {minutes}:{seconds < 10 ? '0' : ''}
                {seconds}
              </>
            );
          })()}
        </div>
        <HorizontalSpacer width={0} flexGrow={1} />
        <Arrow />
      </div>
    </div>
  );
};
