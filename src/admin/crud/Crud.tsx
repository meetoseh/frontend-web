import { ReactElement } from 'react';
import styles from './Crud.module.css';

type CrudProps = {
  /**
   * The title for the page, e.g., "Journeys"
   */
  title: string;

  /**
   * The component which contains one block per item in the listing,
   * typically via a CrudListing block containing many CrudListingItem
   * and a CrudListingMore block.
   */
  listing: ReactElement;

  /**
   * The component which contains the form for creating a new item,
   * may be null if creating items doesn't make sense for this page.
   */
  create: ReactElement | null;

  /**
   * The filters the user can apply to the listing. These filters
   * should be persisted via the query parameters for deep linking.
   */
  filters: ReactElement;
};

/**
 * Manages the basic layout for a CRUD page. This is a two-column
 * layout on desktop, where the left column contains the listing and
 * create form, and the right column contains the filters.
 *
 * The three components will typically be prop-drilled the items
 * in the listing, at minimum.
 */
export const Crud = ({ title, listing, create, filters }: CrudProps): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>{title}</div>
      <div className={styles.content}>
        <div className={styles.left}>
          <div className={styles.listingContainer}>{listing}</div>
          <div className={styles.createContainer}>{create}</div>
        </div>
        <div className={styles.right}>
          <div className={styles.filtersContainer}>{filters}</div>
        </div>
      </div>
    </div>
  );
};
