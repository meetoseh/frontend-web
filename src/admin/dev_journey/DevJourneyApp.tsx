import { ReactElement, useEffect, useState } from 'react';
import { LoginProvider } from '../../shared/contexts/LoginContext';
import '../../assets/fonts.css';
import { DevJourney } from './DevJourney';
import { HTTP_API_URL } from '../../shared/ApiConstants';

/**
 * Describes a reference to a journey, which provides basic meta information
 * as well as the required authorization
 */
export type JourneyRef = {
  /** The UID of the journey */
  uid: string;
  /** The JWT that can be used to access the journey */
  jwt: string;
  /** The duration of the audio content for the journey, in seconds */
  durationSeconds: number;
  /**
   * The width of each bin in the fenwick tree, used for computing prefix
   * sums of events. This is relevant when fetching e.g. the total number
   * of likes up to 3s into the journey. That data can only be retrieved
   * from the backend at multiples of this value. When fetching from the
   * server, rather then specifying the desired time we instead specify
   * the integer multiple of the bin width.
   */
  fenwickBinWidth: number;
  /**
   * The prompt information for the journey. Has a style which can be
   * used to deduce the real type.
   */
  prompt: any;
};

/**
 * Provides the same functionality as the main journey experience screen,
 * but displayed in a manner more conducive to debugging and understanding
 * how it's technically built.
 */
export default function DevJourneyApp(): ReactElement {
  const [uid, setUid] = useState('');
  const [journeyRef, setJourneyRef] = useState<JourneyRef | null>(null);

  useEffect(() => {
    let active = true;
    fetchRef();
    return () => {
      active = false;
    };

    async function fetchRef() {
      setJourneyRef(null);

      if (uid === '') {
        return;
      }

      const response = await fetch(`${HTTP_API_URL}/api/1/journeys/dev_show/${uid}`);
      if (!active) {
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.log('failed to fetch dev journey ', uid, ': ', text);
        return;
      }

      const data = await response.json();
      if (!active) {
        return;
      }

      setJourneyRef({
        uid: data.uid,
        jwt: data.jwt,
        durationSeconds: data.duration_seconds,
        fenwickBinWidth: data.fenwick_bin_width,
        prompt: data.prompt,
      });
    }
  }, [uid]);

  return (
    <LoginProvider>
      <div
        style={{
          padding: '24px',
          maxWidth: '1464px',
          margin: '60px auto',
          background: '#fcfafa',
          borderRadius: '8px',
          boxShadow: '0 0 4px #fcfafa',
          fontFamily: 'Open Sans',
          fontSize: '16px',
        }}>
        <div
          style={{
            padding: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.25em',
          }}>
          <span>uid:</span>
          <input
            type="text"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            style={{
              padding: '2px 4px',
              fontFamily: 'Roboto Mono',
              color: 'black',
              width: '100%',
              maxWidth: '25em',
            }}
          />
        </div>

        {journeyRef && <DevJourney key={journeyRef.uid} journeyRef={journeyRef} />}
      </div>
    </LoginProvider>
  );
}
