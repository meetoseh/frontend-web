import { ReactElement, useMemo } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import dashboardStyles from '../dashboard/AdminDashboard.module.css';
import dashboardIcons from '../dashboard/icons.module.css';
import myStyles from './SharingDashboard.module.css';
import { SectionDescription } from '../notifs_dashboard/AdminNotifsDashboard';
import { AdminDashboardTopBlock } from '../dashboard/AdminDashboardTopBlock';
import { TopSharers } from './subComponents/TopSharers';
import { ShareViewsSmallChart } from './subComponents/ShareViewsSmallChart';
import { combineClasses } from '../../shared/lib/combineClasses';
import { FlowChart } from '../../shared/components/flowchart/FlowChart';
import { AdminDashboardSimpleTopBlock } from '../dashboard/AdminDashboardSimpleTopBlock';
import { useJourneyLinkViewStatsComplete } from './hooks/useJourneyLinkViewStatsComplete';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { NetworkBlockStats } from '../lib/NetworkBlockStats';
import {
  formatNetworkDuration,
  formatNetworkNumber,
  formatNetworkString,
  formatNetworkUnixTimestamp,
} from '../../shared/lib/networkResponseUtils';
import { NetworkChart } from '../lib/NetworkChart';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';

/**
 * The admin sharing dashboard, which is intended to inspecting the effectiveness
 * and health of our sharing system.
 */
export const AdminSharingDashboard = (): ReactElement => {
  const linkViewStats = useJourneyLinkViewStatsComplete();

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Sharing Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Highlights</div>
          <SectionDescription>
            <p>
              This section is intended to contain the most important metrics for evaluating the
              effectiveness of the sharing system.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <div className={dashboardStyles.topBlocksContainer}>
              <AdminDashboardSimpleTopBlock
                iconClassName={myStyles.iconLink}
                path="/api/1/admin/journey_share_links/total_links_created"
                label="Links Created"
              />
              <AdminDashboardSimpleTopBlock
                iconClassName={dashboardIcons.totalViews}
                path="/api/1/admin/journey_share_links/total_views"
                label="Views"
              />
              <AdminDashboardSimpleTopBlock
                iconClassName={dashboardIcons.totalMembers}
                path="/api/1/admin/journey_share_links/total_attributable_users"
                label="Attributable Users"
              />
              <AdminDashboardSimpleTopBlock
                iconClassName={dashboardIcons.totalViews}
                path="/api/1/admin/journey_share_links/total_unique_views"
                label="Unique Views"
              />
            </div>
            <div className={dashboardStyles.centerContainer}>
              <div className={dashboardStyles.centerLeftContainer}>
                <TopSharers />
              </div>
              <div className={dashboardStyles.centerRightContainer}>
                <ShareViewsSmallChart linkViewStats={linkViewStats} />
                <RenderGuardedComponent
                  props={useMappedValueWithCallbacks(linkViewStats, (v) => v.result)}
                  component={(result) => {
                    let value = 0;
                    if (result !== null && result !== undefined) {
                      const now = Date.now();
                      const sevenDaysAgoIsoformat = new Date(now - 7 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split('T')[0];
                      const sevenDaysAgoIndex =
                        result.historical.labels.indexOf(sevenDaysAgoIsoformat);

                      if (sevenDaysAgoIndex !== -1) {
                        for (let i = sevenDaysAgoIndex; i < result.historical.labels.length; i++) {
                          value += result.historical.view_hydrated[i];
                          value += result.historical.view_client_followed[i];
                        }
                      }

                      value += result.partial.today.view_hydrated;
                      value += result.partial.today.view_client_followed;
                      value += result.partial.yesterday.view_hydrated;
                      value += result.partial.yesterday.view_client_followed;
                    }

                    return (
                      <AdminDashboardTopBlock
                        iconClassName={dashboardIcons.totalViews}
                        value={value}
                        label="Views Last 7 Days"
                      />
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Links</div>
          <SectionDescription>
            <p>
              Creating links is relatively straightforward: when the user presses a share button
              within the app on a journey, the client requests a link from the server. The server
              will either generate a link and return it, or, if the user has already recently
              requested a link for that journey, the server will return the same link that was
              generated previously. The only other restriction on link generation is that the
              generated links must be short, ideally 4 characters of randomness, but always return
              quickly.
            </p>
            <p>Viewing links is more complicated. The success criteria are:</p>
            <ul>
              <li>
                The initial fetch for the link should embed metadata about the journey, e.g., its
                title
              </li>
              <li>
                Loading links should feel and be fast, especially for completely fresh clients
              </li>
              <li>
                The server should be able to handle a reasonable burst of requests for share links
                while maintaining fast loading
              </li>
              <li>
                Link clicks should be trackable, i.e., we should be able to understand how many
                views a link got, and if those are from new or existing users, and if those users go
                on to sign up.
              </li>
              <li>
                Automated code scanning should be mitigated, primarily to prevent the above data
                from being muddied and protect the integrity of any deals offered through the
                sharing system (e.g., a future sharing rewards system)
              </li>
            </ul>
            <p>
              The two hardest combinations are providing metadata in the initial request while
              supporting tracking, and mitigating automated code scanning while keeping links short.
            </p>
            <p>
              Under normal circumstances, when viewing a link via the web, we will immediately
              process the code embedded in the link in{' '}
              <span className={myStyles.mono}>frontend-ssr-web</span>, server-side render most of
              the page with the appropriate metadata, and hydrate the remaining identifiers for the
              client. Then, the client will ping the server again after the page is ready confirming
              the view and providing additional tracking data (e.g., authorization).
            </p>
            <p>
              When automated code scanning is detected or when a non-web client is desired, the
              client will instead make an explicit api request to follow the code along with all
              tracking information, then generate the page client-side. This is slower and does not
              allow for filling metadata, but provides more information to the ratelimiting system
              in order for filtering out automated code scanning.
            </p>
            <p>
              In general, we refer to the first step under normal circumstances as phase 1
              (hydration), the second step under normal circumstances as phase 2 (confirmation), and
              the alternative as phase 3 (api).
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart
              tree={{
                element: (
                  <div
                    className={combineClasses(styles.block, styles.blockServer)}
                    style={{ maxWidth: '500px' }}>
                    <div className={styles.blockTag}>
                      Server <pre>(frontend-ssr-web)</pre>
                    </div>
                    <div className={styles.blockTitle}>Phase 1: Hydration</div>
                    <div className={styles.blockDescription}>
                      <p>
                        The server receives an HTTP GET request to a URL which it detects is a share
                        link (<span className={myStyles.mono}>oseh.io/s/*</span>) and directs
                        towards the <span className={myStyles.mono}>frontend-ssr-web</span> service.
                      </p>
                      <p>
                        At this point, the server can either choose to ratelimit the request, by not
                        hydrating information and loading javascript that will use phase 3, or
                        process the request, which will either result in determining the code is
                        valid and server-side rendering the appropriate share page including
                        metadata, or determining the code is invalid, and server-side rendering the
                        appropriate 404 page including metadata.
                      </p>
                    </div>
                  </div>
                ),
                children: [
                  {
                    element: (
                      <div className={combineClasses(styles.block, styles.blockServer)}>
                        <div className={styles.blockTag}>
                          Server <pre>(frontend-ssr-web)</pre>
                        </div>
                        <div className={styles.blockTitle}>Queue Link View</div>
                        <div className={styles.blockDescription}>
                          <p>
                            If hydration is successful, we add the view to a redis key with a
                            specific format that we collectively refer to as the View Pseudo-Set,
                            and add it to a sorted set we refer to as the Unconfirmed Views Sorted
                            Set.
                          </p>
                        </div>
                      </div>
                    ),
                    children: [
                      {
                        element: (
                          <div className={combineClasses(styles.block, styles.blockClient)}>
                            <div className={styles.blockTag}>
                              Client <pre>(frontend-ssr-web)</pre>
                            </div>
                            <div className={styles.blockTitle}>Phase 2a: Confirmation</div>
                            <div className={styles.blockDescription}>
                              <p>
                                The client will send a request to the{' '}
                                <span className={myStyles.mono}>backend</span> service after loading
                                the hydrated page alongside client-stored credentials.
                              </p>
                            </div>
                          </div>
                        ),
                        children: [
                          {
                            element: (
                              <div className={combineClasses(styles.block, styles.blockServer)}>
                                <div className={styles.blockTag}>
                                  Server <pre>(backend)</pre>
                                </div>
                                <div className={styles.blockTitle}>Phase 2b: Confirmation</div>
                                <div className={styles.blockDescription}>
                                  <p>
                                    The <span className={myStyles.mono}>backend</span> server will
                                    remove the view from the Unconfirmed Views Sorted Set, update
                                    the entry in the View Pseudo-Set to include the new tracking
                                    information, and add it to the redis list we call the View To
                                    Log Queue.
                                  </p>
                                </div>
                              </div>
                            ),
                            children: [
                              {
                                element: (
                                  <div className={combineClasses(styles.block, styles.blockServer)}>
                                    <div className={styles.blockTag}>
                                      Server <pre>(jobs)</pre>
                                    </div>
                                    <div className={styles.blockTitle}>Log Job</div>
                                    <div className={styles.blockDescription}>
                                      <p>
                                        About once every 5 minutes, the Log Job will take values
                                        from the left of the View To Log Queue, remove them from the
                                        View Pseudo-Set, and persist them in the database table{' '}
                                        <span className={myStyles.mono}>
                                          journey_share_link_views
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                ),
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    element: (
                      <div className={combineClasses(styles.block, styles.blockClient)}>
                        <div className={styles.blockTag}>
                          Client <pre>(frontend-ssr-web)</pre>
                        </div>
                        <div className={styles.blockTitle}>Phase 3a: API</div>
                        <div className={styles.blockDescription}>
                          <p>
                            If the server determines we may be actively undergoing a code-scanning
                            attack according to the number of recently processed invalid codes, it
                            will not hydrate the page, and instead load javascript that will
                            immediately make an API request to the{' '}
                            <span className={myStyles.mono}>backend</span> service alongside
                            client-stored credentials.
                          </p>
                        </div>
                      </div>
                    ),
                    children: [
                      {
                        element: (
                          <div className={combineClasses(styles.block, styles.blockServer)}>
                            <div className={styles.blockTag}>
                              Server <pre>(backend)</pre>
                            </div>
                            <div className={styles.blockTitle}>Phase 3b: API</div>
                            <div className={styles.blockDescription}>
                              <p>
                                The <span className={myStyles.mono}>backend</span> service will use
                                the provided credentials to determine if it will process the
                                request. If it does not process the request, a 429 is returned,
                                which may be handled by the client by redirecting to the homepage or
                                displaying an error.
                              </p>
                              <p>
                                If it does process the request and the code is valid, an entry is
                                added to the View Pseudo-Set (already confirmed) and added to the
                                right of the View To Log Queue, and the data is returned to the
                                client to display.
                              </p>
                              <p>
                                If it does process the request and the code is invalid, ratelimiting
                                keys are updated (which may include per-visitor or per-user
                                tracking) and a 404 is returned to the client, which it may handle
                                by redirecting to the homepage or displaying an error.
                              </p>
                            </div>
                          </div>
                        ),
                        children: [
                          {
                            element: (
                              <div className={combineClasses(styles.block, styles.blockServer)}>
                                <div className={styles.blockTag}>
                                  Server <pre>(jobs)</pre>
                                </div>
                                <div className={styles.blockTitle}>Log Job</div>
                                <div className={styles.blockDescription}>
                                  <p>Same as after Phase 2B: Confirmation</p>
                                </div>
                              </div>
                            ),
                            children: [],
                          },
                        ],
                      },
                    ],
                  },
                ],
              }}
            />

            <FlowChart
              tree={{
                element: (
                  <div
                    className={combineClasses(styles.block, styles.blockServer)}
                    style={{ maxWidth: '500px' }}>
                    <div className={styles.blockTag}>
                      Server <pre>(jobs)</pre>
                    </div>
                    <div className={styles.blockTitle}>Unconfirmed View Sweep Job</div>
                    <div className={styles.blockDescription}>
                      <p>
                        About once every 15 minutes, a job will sweep through old unconfirmed views.
                        For those which were only for ratelimiting, i.e., the code was invalid but
                        we stored it in the View Pseudo-Set so we could check if the client
                        confirmed it, they are simply removed from the View Pseudo-Set and
                        Unconfirmed Views Sorted Set. Otherwise, if they were for a valid code, we
                        append them to the View To Log Queue.
                      </p>
                      <p>
                        This is necessary for clients which are either purposely not confirming
                        views, or there was a transient error in the confirmation process.
                      </p>
                      <NetworkBlockStats
                        path="/api/1/admin/journey_share_links/last_unconfirmed_view_sweep_job"
                        items={useMemo(
                          () => [
                            { key: 'started_at', format: formatNetworkUnixTimestamp },
                            { key: 'finished_at', format: formatNetworkUnixTimestamp },
                            { key: 'running_time', format: formatNetworkDuration },
                            { key: 'found', format: formatNetworkNumber },
                            { key: 'removed', format: formatNetworkNumber },
                            { key: 'queued', format: formatNetworkNumber },
                            { key: 'stop_reason', format: formatNetworkString },
                            { key: 'unconfirmed_length', format: formatNetworkNumber },
                            { key: 'oldest_unconfirmed_at', format: formatNetworkUnixTimestamp },
                          ],
                          []
                        )}
                      />
                    </div>
                  </div>
                ),
                children: [
                  {
                    element: (
                      <div
                        className={combineClasses(styles.block, styles.blockServer)}
                        style={{ maxWidth: '600px' }}>
                        <div className={styles.blockTag}>
                          Server <pre>(jobs)</pre>
                        </div>
                        <div className={styles.blockTitle}>Log Job</div>
                        <div className={styles.blockDescription}>
                          <p>
                            About once every 5 minutes, the Log Job will take values from the left
                            of the View To Log Queue, remove them from the View Pseudo-Set and
                            Unconfirmed Views Sorted Set and persist them in the database table{' '}
                            <span className={myStyles.mono}>journey_share_link_views</span>
                          </p>
                          <NetworkBlockStats
                            path="/api/1/admin/journey_share_links/views_to_log_info"
                            items={useMemo(
                              () => [
                                {
                                  key: 'length',
                                  name: 'To Log Length',
                                  format: formatNetworkNumber,
                                },
                                { key: 'first_clicked_at', format: formatNetworkUnixTimestamp },
                                { key: 'first_confirmed_at', format: formatNetworkUnixTimestamp },
                              ],
                              []
                            )}
                          />
                          <NetworkBlockStats
                            path="/api/1/admin/journey_share_links/last_log_job"
                            items={useMemo(
                              () => [
                                { key: 'started_at', format: formatNetworkUnixTimestamp },
                                { key: 'finished_at', format: formatNetworkUnixTimestamp },
                                { key: 'running_time', format: formatNetworkDuration },
                                { key: 'attempted', format: formatNetworkNumber },
                                { key: 'persisted', format: formatNetworkNumber },
                                { key: 'partially_persisted', format: formatNetworkNumber },
                                { key: 'failed', format: formatNetworkNumber },
                                { key: 'stop_reason', format: formatNetworkString },
                                { key: 'purgatory_length', format: formatNetworkNumber },
                                {
                                  key: 'raced_views_to_confirm_length',
                                  format: formatNetworkNumber,
                                },
                              ],
                              []
                            )}
                          />
                        </div>
                      </div>
                    ),
                    children: [],
                  },
                ],
              }}
            />
            <div
              className={combineClasses(styles.block, styles.blockServer)}
              style={{ maxWidth: '500px', margin: '0 auto 48px auto' }}>
              <div className={styles.blockTag}>
                Server <pre>(jobs)</pre>
              </div>
              <div className={styles.blockTitle}>Raced Confirmations Sweep Job</div>
              <div className={styles.blockDescription}>
                <p>
                  About once per minute, a job will sweep through view confirmations that occurred
                  while the view was in the Log Job purgatory and persist them to the database.
                </p>
                <p>
                  This job is required because when a view confirmation is received, we normally
                  want to update the View Pseudo-Set (if there) so that the Log Job simply persists
                  the confirmation along with the original view when it gets to the job, and if it's
                  not in the View Pseudo-Set then it will be in the database where it can be
                  mutated. However, if it is in the View Pseudo-Set and the Log Job is actively
                  processing it, i.e., its in the Log Jobs' purgatory set, then the Log Job may have
                  already read the value from the View Pseudo-Set and hence might miss mutations. So
                  instead we write to a separate hash we call the Raced Confirmations Hash which
                  will be scanned separately.
                </p>
                <p>
                  Because repeated confirmations are dropped, we wouldn't run into the same
                  purgatory issue with the Raced Confirmations Sweep Job, as we would never want to
                  mutate the View Pseudo-Set for entries in the Raced Confirmations Sweep Job
                  purgatory. Except we determine if the visitor was unique in a separate step
                  compared to the one which sets if its confirmed, in order to reduced database load
                  on duplicate or invalid view confirmations.
                </p>
                <p>
                  Since unique visitors is already a best-effort metric that can undercount but
                  never overcount, the only mitigation in place for the second race is skipping
                  entries from the raced confirmations hash which are very recent, rather than the
                  strong guarantees around races to the view to log job.
                </p>
                <NetworkBlockStats
                  path="/api/1/admin/journey_share_links/last_raced_confirmations_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
                      { key: 'running_time', format: formatNetworkDuration },
                      { key: 'attempted', format: formatNetworkNumber },
                      { key: 'not_ready', format: formatNetworkNumber },
                      { key: 'persisted', format: formatNetworkNumber },
                      { key: 'partially_persisted', format: formatNetworkNumber },
                      { key: 'failed_did_not_exist', format: formatNetworkNumber },
                      { key: 'failed_already_confirmed', format: formatNetworkNumber },
                      { key: 'stop_reason', format: formatNetworkString },
                      { key: 'raced_confirmations_length', format: formatNetworkNumber },
                    ],
                    []
                  )}
                />
              </div>
            </div>
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/journey_share_links/partial_journey_share_link_stats"
            historicalDataPath="/api/1/admin/journey_share_links/journey_share_link_stats"
            marginBottom={48}
          />
          <NetworkChart
            partialDataPath="/api/1/admin/journey_share_links/partial_journey_share_link_unique_views"
            historicalDataPath="/api/1/admin/journey_share_links/journey_share_link_unique_views"
            suppressInPartial={['unique_views']}
          />
        </div>
      </div>
    </div>
  );
};
