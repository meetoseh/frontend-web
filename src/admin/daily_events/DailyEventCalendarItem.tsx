import {
  MouseEvent,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '../../shared/forms/Button';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { DailyEvent } from './DailyEvent';
import { DailyEventCalendarEdit } from './DailyEventCalendarEdit';
import styles from './DailyEventCalendarItem.module.css';

type DailyEventCalendarItemProps = {
  /**
   * The date this item is for, midnight local time
   */
  date: Date;
  /**
   * The events occuring on this day, in ascending availableAt
   */
  events: DailyEvent[];
  /**
   * Called when the user wants to add a new daily event, with the date
   * @param date Matches the prop date
   */
  onWantAdd: (this: void, date: Date) => void;

  /**
   * Called when the user edited an event
   * @param event the edited event
   */
  onEdited: (this: void, event: DailyEvent) => void;

  /**
   * Called when the user deleted an event
   * @param event the deleted event
   */
  onDeleted: (this: void, event: DailyEvent) => void;
};

export const DailyEventCalendarItem = ({
  date,
  events,
  onWantAdd,
  onEdited,
  onDeleted,
}: DailyEventCalendarItemProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const [showEditEvent, setShowEditEvent] = useState<DailyEvent | null>(null);

  const today = useMemo(() => {
    const res = new Date();
    res.setHours(0, 0, 0, 0);
    return res;
  }, []);

  const onClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onWantAdd(date);
    },
    [date, onWantAdd]
  );

  useEffect(() => {
    if (showEditEvent === null) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowEditEvent(null)}>
        <DailyEventCalendarEdit
          event={showEditEvent}
          onEdit={(newEvent) => {
            onEdited(newEvent);
            setShowEditEvent(null);
          }}
          onDelete={(deletedEvent) => {
            onDeleted(deletedEvent);
            setShowEditEvent(null);
          }}
        />
      </ModalWrapper>
    );
  }, [modalContext.setModals, showEditEvent, onEdited, onDeleted]);

  return (
    <div className={styles.container}>
      {events && (
        <div className={styles.eventsContainer}>
          {events.map((event) => {
            return (
              <button
                type="button"
                className={styles.eventButton}
                onClick={(e) => {
                  e.preventDefault();
                  setShowEditEvent(event);
                }}
                key={event.uid}>
                <div className={styles.event}>
                  <div className={styles.eventTime}>
                    {event.availableAt!.toLocaleTimeString(undefined, {
                      timeStyle: 'short',
                    })}
                  </div>
                  <div className={styles.eventNumJourneys}>{event.numberOfJourneys} opt.</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {date >= today && events.length === 0 && (
        <div className={styles.addContainer}>
          <Button type="button" variant="link-small" onClick={onClick}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
};
