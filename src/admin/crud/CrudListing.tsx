import { ReactElement } from 'react';
import styles from './CrudListing.module.css';

type CrudListingProps<T> = {
  /**
   * The items matching the filters
   */
  items: T[];

  /**
   * Converts an item to a component to render in the listing
   * @param item The item to convert
   * @returns The corresponding component, key'd by the item's ID
   */
  component: (item: T) => ReactElement;

  /**
   * Whether a request is currently in flight to load more items
   */
  loading: boolean;

  /**
   * Whether there are more items to load, triggers a more button
   */
  haveMore: boolean;

  /**
   * Called when the more button is clicked
   */
  onMore: () => void;
};

/**
 * Convenience component for when creating a listing component within a CRUD
 * page. This will map the given list of items to the given component, adding
 * a "more" button at the bottom of the list if there are more items to show,
 * which calls the given function to load more items.
 */
export function CrudListing<T>({
  items,
  component,
  loading,
  haveMore,
  onMore,
}: CrudListingProps<T>): ReactElement {
  return (
    <div
      className={`${styles.container} ${
        loading && styles.loadingContainer ? styles.loadingContainer : ''
      } ${haveMore && styles.haveMoreContainer ? styles.haveMoreContainer : ''}`.trimEnd()}>
      {loading && items.length === 0 ? (
        <div className={styles.emptyLoadingContainer}>
          <div className={styles.emptyLoadingText}>Loading...</div>
        </div>
      ) : null}
      {!loading && items.length === 0 ? (
        <div className={styles.emptyContainer}>
          <div className={styles.emptyText}>No items found</div>
        </div>
      ) : null}
      <div className={styles.listingContainer}>{items.map((item) => component(item))}</div>
      {haveMore ? (
        <div className={styles.moreContainer}>
          <button type="button" className={styles.moreButton} onClick={onMore} disabled={loading}>
            Load More
          </button>
        </div>
      ) : null}
    </div>
  );
}
