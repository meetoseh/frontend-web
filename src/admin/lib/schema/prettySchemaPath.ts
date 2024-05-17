/**
 * Converts a schema path to a relatively interpretable string.
 */
export const prettySchemaPath = (path: (string | number)[]): string => {
  let parts = [];
  for (let i = 0; i < path.length; i++) {
    if (typeof path[i] === 'string') {
      if (i !== 0) {
        parts.push('.');
      }
      parts.push(path[i]);
    } else {
      parts.push(`[${path[i]}]`);
    }
  }
  return parts.join('');
};

/**
 * Converts the given pretty path back into the original path.
 */
export const parsePrettySchemaPath = (path: string): (string | number)[] => {
  let parts = [];
  let currentPart = '';
  for (let i = 0; i < path.length; i++) {
    if (path[i] === '[') {
      if (currentPart.length > 0) {
        parts.push(currentPart);
        currentPart = '';
      }
    } else if (path[i] === ']') {
      parts.push(parseInt(currentPart));
      currentPart = '';
    } else if (path[i] === '.') {
      if (currentPart.length > 0) {
        parts.push(currentPart);
        currentPart = '';
      }
    } else {
      currentPart += path[i];
    }
  }
  if (currentPart.length > 0) {
    parts.push(currentPart);
  }
  return parts;
};
