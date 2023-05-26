import { ReactElement, useEffect, useState } from 'react';
import '../../../../assets/fonts.css';
import { AdminNavDesktopSideLink } from '../side/AdminNavDesktopSideLink';
import styles from './AdminNavDesktopTopSearch.module.css';
import sideContentStyles from '../side/AdminNavDesktopSideContent.module.css';

const PAGE_RESULTS: {
  identifier: string;
  aliases: string[];
  result: ReactElement;
}[] = [
  {
    identifier: 'dashboard',
    aliases: ['dashboard'],
    result: (
      <div className={styles.resultItem}>
        <AdminNavDesktopSideLink
          iconClass={sideContentStyles.iconDashboard}
          text="Dashboard"
          url="/admin"
          active={false}
        />
      </div>
    ),
  },
  {
    identifier: 'vip',
    aliases: ['vip', 'chat requests', 'vip chat requests'],
    result: (
      <div className={styles.resultItem}>
        <AdminNavDesktopSideLink
          iconClass={sideContentStyles.iconVIPChatRequests}
          text="VIP Chat Requests"
          url="/admin/vip_chat_requests"
          active={false}
          padTextTop={4}
        />
      </div>
    ),
  },
  {
    identifier: 'users',
    aliases: ['users', 'people', 'person', 'persons'],
    result: (
      <div className={styles.resultItem}>
        <AdminNavDesktopSideLink
          iconClass={sideContentStyles.iconUsers}
          text="Users"
          url="/admin/users"
          active={false}
        />
      </div>
    ),
  },
  {
    identifier: 'journeys',
    aliases: ['journeys', 'classes'],
    result: (
      <div className={styles.resultItem}>
        <AdminNavDesktopSideLink
          iconClass={sideContentStyles.iconJourneys}
          text="Journeys"
          url="/admin/journeys"
          active={false}
        />
      </div>
    ),
  },
  {
    identifier: 'instructors',
    aliases: ['instructors', 'teachers'],
    result: (
      <div className={styles.resultItem}>
        <AdminNavDesktopSideLink
          iconClass={sideContentStyles.iconInstructors}
          text="Instructors"
          url="/admin/instructors"
          active={false}
        />
      </div>
    ),
  },
];

export const AdminNavDesktopTopSearch = (): ReactElement => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReactElement[]>([]);

  useEffect(() => {
    if (query.length === 0) {
      setResults([]);
    } else {
      const loweredQuery = query.toLowerCase();
      setResults(
        PAGE_RESULTS.filter((page) =>
          page.aliases.some((alias) => alias.includes(loweredQuery))
        ).map((page) => <div key={page.identifier}>{page.result}</div>)
      );
    }
  }, [query]);

  return (
    <div className={styles.container}>
      <div className={styles.searchContainer}>
        <div className={styles.searchIconContainer}>
          <span className={styles.searchIcon} />
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Enter keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.resultsContainer}>{results}</div>
    </div>
  );
};
