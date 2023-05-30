import { ReactElement, useContext, useState } from 'react';
import styles from './BigUserAttribution.module.css';
import { User } from '../User';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { UTM } from '../../../shared/hooks/useVisitor';
import { CrudFetcherKeyMap, convertUsingKeymap } from '../../crud/CrudFetcher';
import { Journey } from '../../journeys/Journey';
import { keyMap } from '../../journeys/Journeys';
import { AdminDashboardLargeChartPlaceholder } from '../../dashboard/AdminDashboardLargeChartPlaceholder';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { useSingletonEffect } from '../../../shared/lib/useSingletonEffect';
import { LoginContext } from '../../../shared/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { CompactJourney } from '../../journeys/CompactJourney';

type UTMClick = UTM & {
  clickedAt: Date;
};

const utmClickKeyMap: CrudFetcherKeyMap<UTMClick> = {
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_term: 'term',
  utm_content: 'content',
  clicked_at: (_, v) => ({ key: 'clickedAt', value: new Date(v * 1000) }),
};

type JourneyPublicLinkView = {
  journey: Journey;
  code: string;
  clickedAt: Date;
};

const journeyPublicLinkViewKeyMap: CrudFetcherKeyMap<JourneyPublicLinkView> = {
  journey: (_, v) => ({ key: 'journey', value: convertUsingKeymap(v, keyMap) }),
  clicked_at: (_, v) => ({ key: 'clickedAt', value: new Date(v * 1000) }),
};

type AttributionInfo = {
  utms: UTMClick[];
  journeyPublicLinks: JourneyPublicLinkView[];
  firstSeenAt: Date;
};

const attributionInfoKeyMap: CrudFetcherKeyMap<AttributionInfo> = {
  utms: (_, v: any[]) => ({
    key: 'utms',
    value: v.map((x) => convertUsingKeymap(x, utmClickKeyMap)),
  }),
  journey_public_links: (_, v: any[]) => ({
    key: 'journeyPublicLinks',
    value: v.map((x) => convertUsingKeymap(x, journeyPublicLinkViewKeyMap)),
  }),
  first_seen_at: (_, v) => ({ key: 'firstSeenAt', value: new Date(v * 1000) }),
};

/**
 * Displays attribution information about a user, i.e., utms they clicked
 * before getting here, etc.
 */
export const BigUserAttribution = ({ user }: { user: User }): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [attributionInfo, setAttributionInfo] = useState<
    { sub: string; info: AttributionInfo | null } | undefined
  >(undefined);
  const [error, setError] = useState<ReactElement | null>(null);

  useSingletonEffect(
    (onDone) => {
      if (attributionInfo !== undefined && attributionInfo.sub === user.sub) {
        onDone();
        return;
      }

      if (loginContext.state !== 'logged-in') {
        onDone();
        return;
      }

      let active = true;
      fetchAttributionInfo();
      return () => {
        active = false;
      };

      async function fetchAttributionInfoInner() {
        const response = await apiFetch(
          `/api/1/users/${user.sub}/attribution`,
          {
            method: 'GET',
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const raw = await response.json();
        const data = convertUsingKeymap(raw, attributionInfoKeyMap);
        if (active) {
          setAttributionInfo({ sub: user.sub, info: data });
        }
      }

      async function fetchAttributionInfo() {
        try {
          await fetchAttributionInfoInner();
        } catch (e) {
          const err = await describeError(e);
          if (active) {
            setError(err);
            setAttributionInfo({ sub: user.sub, info: null });
          }
        } finally {
          onDone();
        }
      }
    },
    [loginContext, attributionInfo, user]
  );

  if (attributionInfo === undefined) {
    return <AdminDashboardLargeChartPlaceholder />;
  }

  if (attributionInfo.info === null) {
    return (
      <CrudItemBlock title="Attribution" controls={null}>
        {error && <ErrorBlock>{error}</ErrorBlock>}
        No attribution information available
      </CrudItemBlock>
    );
  }

  return (
    <CrudItemBlock title="Attribution" controls={null}>
      {error && <ErrorBlock>{error}</ErrorBlock>}

      <CrudFormElement title="UTMs">
        {attributionInfo.info.utms.length === 0 && <>No attributable UTMs</>}
        {attributionInfo.info.utms.map((utm, i) => {
          return (
            <div className={styles.utmContainer} key={i}>
              <CrudFormElement title="UTM" noTopMargin>
                <ul className={styles.utmList}>
                  <li>source={utm.source}</li>
                  {utm.campaign && <li>campaign={utm.campaign}</li>}
                  {utm.medium && <li>medium={utm.medium}</li>}
                  {utm.term && <li>term={utm.term}</li>}
                  {utm.content && <li>content={utm.content}</li>}
                </ul>
              </CrudFormElement>
              <CrudFormElement title="Clicked at">{utm.clickedAt.toLocaleString()}</CrudFormElement>
            </div>
          );
        })}
      </CrudFormElement>

      <CrudFormElement title="Journey public links">
        {attributionInfo.info.journeyPublicLinks.length === 0 && (
          <>No attributable journey public links</>
        )}

        {attributionInfo.info.journeyPublicLinks.map((link, i) => {
          return (
            <div className={styles.attributionInfoContainer} key={i}>
              <CompactJourney journey={link.journey} />
              <CrudFormElement title="Code">{link.code}</CrudFormElement>
              <CrudFormElement title="Clicked at">
                {link.clickedAt.toLocaleString()}
              </CrudFormElement>
            </div>
          );
        })}
      </CrudFormElement>

      <CrudFormElement title="First seen at">
        {attributionInfo.info.firstSeenAt.toLocaleString()}
      </CrudFormElement>
    </CrudItemBlock>
  );
};