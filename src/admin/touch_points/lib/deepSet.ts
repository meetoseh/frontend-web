export const deepSet = (obj: any, path: (string | number)[], value: any) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (path.length === 0) {
    return value;
  }

  const [head, ...tail] = path;
  if (tail.length === 0) {
    obj[head] = value;
    return obj;
  }

  if (obj[head] === undefined) {
    obj[head] = typeof tail[0] === 'number' ? [] : {};
  }

  deepSet(obj[head], tail, value);
  return obj;
};
