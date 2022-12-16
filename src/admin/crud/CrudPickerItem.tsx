import { useMemo } from 'react';

type CrudPickerItemProps = {
  /**
   * The query string the user put in
   */
  query: string;

  /**
   * The value of the text field which matched the query
   */
  match: string;
};

/**
 * A basic component to use for the CrudPicker's component prop. This
 * will highlight the part of the text which matched the query.
 */
export const CrudPickerItem = ({ query, match }: CrudPickerItemProps) => {
  const parts: { text: string; match: boolean }[] = useMemo(() => {
    const result: { text: string; match: boolean }[] = [];
    let lastMatch = 0;
    let matchIndex = match.toLowerCase().indexOf(query.toLowerCase());

    while (matchIndex !== -1) {
      result.push({ text: match.substring(lastMatch, matchIndex), match: false });
      result.push({ text: match.substring(matchIndex, matchIndex + query.length), match: true });
      lastMatch = matchIndex + query.length;
      matchIndex = match.toLowerCase().indexOf(query.toLowerCase(), lastMatch);
    }

    result.push({ text: match.substring(lastMatch), match: false });

    return result;
  }, [query, match]);

  return (
    <span>
      {parts.map((part, i) =>
        part.match ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>
      )}
    </span>
  );
};
