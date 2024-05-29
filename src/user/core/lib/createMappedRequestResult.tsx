import { createMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { RequestResult, RequestResultConcrete } from '../../../shared/requests/RequestHandler';

/**
 * Creates a new request result that cleans itself up in the release() function
 * of the returned object and whose data comes from a mapped version of the
 * originals data.
 *
 * The primary convenience of this function is the mapper can return null to indicate
 * that the data is not available, which will bubble up.
 */
export const createMappedRequestResult = <OriginalDataT extends object, NewDataT extends object>(
  requestResult: RequestResult<OriginalDataT>,
  mapper: (data: OriginalDataT) => { type: 'success'; data: NewDataT } | null
): RequestResult<NewDataT> => {
  const [mappedData, cleanupMapper] = createMappedValueWithCallbacks(
    requestResult.data,
    (v): RequestResultConcrete<NewDataT> => {
      if (v.type === 'success') {
        const mapped = mapper(v.data);
        if (mapped === null) {
          return {
            data: undefined,
            type: 'error',
            error: <>Unavailable</>,
          };
        }
        return {
          data: mapped.data,
          type: 'success',
          error: undefined,
          reportExpired: v.reportExpired,
        };
      }
      return v;
    }
  );

  return {
    data: mappedData,
    release: () => {
      requestResult.release();
      cleanupMapper();
    },
  };
};
