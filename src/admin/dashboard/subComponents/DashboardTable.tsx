import { ReactElement, useCallback } from 'react';
import { Button } from '../../../shared/forms/Button';
import styles from './DashboardTable.module.css';

export type DashboardTableProps = {
  columnHeaders: string[];
  rows: string[][];
};

/**
 * Quotes the given string for CSV, using RFC 4180
 */
const quoteForCsv = (value: string): string => {
  let result = '"';
  let insertedUpToExc = 0;

  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"') {
      result += value.substring(insertedUpToExc, i + 1);
      result += '"';
      insertedUpToExc = i + 1;
      continue;
    }
  }

  result += value.substring(insertedUpToExc);
  result += '"';
  return result;
};

/**
 * A reasonably styled table for use in the admin dashboard
 */
export const DashboardTable = ({ columnHeaders, rows }: DashboardTableProps): ReactElement => {
  const downloadCSV = useCallback(async () => {
    const csv =
      columnHeaders.map(quoteForCsv).join(',') +
      '\n' +
      rows.map((row) => row.map(quoteForCsv).join(',')).join('\n') +
      '\n';

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [columnHeaders, rows]);

  return (
    <div className={styles.container}>
      <Button type="button" variant="link-small" onClick={downloadCSV}>
        Download CSV
      </Button>
      <table className={styles.table}>
        <thead>
          <tr>
            {columnHeaders.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, index) => (
                <td key={index}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
