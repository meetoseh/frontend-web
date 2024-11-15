import { ReactElement, useCallback } from 'react';
import { Button } from '../../../shared/forms/Button';
import styles from './DashboardTable.module.css';

export type DashboardTableProps = {
  columnHeaders: string[];
  rows: (string | { csv: string; display: ReactElement })[][];
  minWidth?: number;
};

/**
 * Quotes the given string for CSV, using RFC 4180
 */
const quoteForCsv = (item: string | { csv: string; display: ReactElement }): string => {
  const value = typeof item === 'string' ? item : item.csv;
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
export const DashboardTable = ({
  columnHeaders,
  rows,
  minWidth,
}: DashboardTableProps): ReactElement => {
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
      <table
        className={styles.table}
        style={minWidth === undefined ? undefined : { minWidth: `${minWidth}px` }}>
        <thead>
          <tr>
            {columnHeaders.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, outerIndex) => (
            <tr key={outerIndex}>
              {row.map((cell, index) => (
                <td key={index}>{typeof cell === 'string' ? cell : cell.display}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
