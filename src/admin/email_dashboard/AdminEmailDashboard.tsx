import { ReactElement } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import {
  NotImplementedBlockStatisticTitleRow,
  SectionDescription,
  SectionGraphs,
} from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { AdminDashboardLargeChartPlaceholder } from '../dashboard/AdminDashboardLargeChartPlaceholder';
import { combineClasses } from '../../shared/lib/combineClasses';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 24 },
  rowGap: { type: 'react-rerender', props: 48 },
  color: { type: 'react-rerender', props: [0, 0, 0, 0.5] },
  lineThickness: { type: 'react-rerender', props: 2 },
  arrowBlockGapPx: { type: 'react-rerender', props: { head: 4, tail: 4 } },
  arrowHeadLengthPx: { type: 'react-rerender', props: 8 },
  arrowHeadAngleDeg: { type: 'react-rerender', props: 30 },
};

/**
 * The admin email dashboard, which is intended to help inspecting the current
 * health our email system.
 */
export const AdminEmailDashboard = (): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Oseh Email Dashboard</div>

      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Templates</div>
          <SectionDescription>
            <p>
              Templating in this context refers to the process of rendering data to HTML or
              plaintext that can be sent as an email. Conventionally, the data itself is a backend
              concern, whereas the HTML or plaintext is a frontend concern. Thus, it is convenient
              and consistent to use <a href="https://react.dev/">React</a> +{' '}
              <a href="https://www.typescriptlang.org/">Typescript</a> to render emails, just as the{' '}
              <span className={styles.mono}>frontend-web</span> and{' '}
              <span className={styles.mono}>frontend-app</span> repositories do. Hence, our
              templating engine of choice is <a href="https://react.email">react.email</a>. We have
              a NodeJS server, running the repository{' '}
              <span className={styles.mono}>email-templates</span>, which accepts HTTP POST requests
              containing the email template name and the props, and then renders the email and
              returns it. It uses the <span className={styles.mono}>Accept</span> request HTTP
              header to determine whether to render to HTML or plain text.
            </p>
            <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
              If and when the{' '}
              <a href="https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-02.html">
                HTTP QUERY Method
              </a>{' '}
              gains support, it can be used to more accurately describe the request semantics: safe,
              idempotent requests that contain a body.
            </div>
            <p>
              Requests are authenticated via Email Template <a href="https://jwt.io/">JWTs</a> both
              for internal server to server requests and for external requests. This allows the
              admin dashboard to render email previews without the web server having to proxy the
              request, so long as the web server issues us the appropriate JWT.
            </p>
            <p>
              The email server uses a standard openapi schema document to expose the available
              templates and their props, which is fetched and used to render the tools in this
              section. Editing or creating templates is done by modifying the
              <span className={styles.mono}>email-templates</span> repository, which means we have
              the full power of git and pull requests to manage changes.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}>
                  Curabitur pulvinar cursus elementum. Proin finibus dui nunc, nec sodales ipsum
                  egestas eget. Mauris a rutrum tortor, mattis accumsan eros. Sed dictum semper
                  augue. Cras id sapien convallis, aliquam eros nec, volutpat lectus. Pellentesque
                  tempor nunc efficitur ante sodales sagittis. Proin fermentum mauris et dignissim
                  mattis. Nulla facilisi. Donec vel mauris vulputate, vulputate lorem molestie,
                  cursus tortor.
                </div>
                <div className={styles.blockStatstic}>
                  <NotImplementedBlockStatisticTitleRow title={<>TODO</>} />
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}>
                  Curabitur pulvinar cursus elementum. Proin finibus dui nunc, nec sodales ipsum
                  egestas eget. Mauris a rutrum tortor, mattis accumsan eros. Sed dictum semper
                  augue. Cras id sapien convallis, aliquam eros nec, volutpat lectus. Pellentesque
                  tempor nunc efficitur ante sodales sagittis. Proin fermentum mauris et dignissim
                  mattis. Nulla facilisi. Donec vel mauris vulputate, vulputate lorem molestie,
                  cursus tortor.
                </div>
                <div className={styles.blockStatstic}>
                  <NotImplementedBlockStatisticTitleRow title={<>TODO</>} />
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <AdminDashboardLargeChartPlaceholder placeholderText="# template requests by type (email vs preview) and response status code, by day" />
            </SectionGraphs>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Messages</div>
          <SectionDescription>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus metus odio, aliquet
              vel bibendum et, malesuada non elit. Mauris dapibus dapibus sagittis. Ut fermentum
              justo bibendum, vehicula nunc ut, porttitor turpis. Aliquam nibh mi, finibus in
              vestibulum eget, sagittis id urna. Praesent semper, sapien ac suscipit semper, tortor
              tortor finibus est, eu vehicula dui nulla sit amet elit. Sed diam orci, lobortis a
              sapien quis, laoreet porttitor dui. Vivamus sit amet massa vitae tellus fermentum
              consectetur eu suscipit tortor. Cras sed mauris nec libero suscipit pellentesque.
            </p>
            <p>
              Duis efficitur est sit amet massa tincidunt, vel finibus sem bibendum. Mauris elit
              orci, accumsan vitae tempor id, commodo eget dolor. Praesent tellus purus, fringilla
              vel lectus quis, lacinia sodales metus. Mauris elementum quam eros, a scelerisque
              ligula euismod a. Cras pulvinar nisi sit amet sagittis varius. Nullam faucibus orci
              eget velit sodales pellentesque. Sed ullamcorper dui odio, eu lobortis lorem luctus
              quis. Donec tortor sem, dictum non dignissim vitae, efficitur eget nibh. Aliquam
              accumsan risus quis nibh interdum sagittis. Praesent dictum leo eu massa cursus, eget
              ornare quam malesuada. Aenean blandit eros quis ante lobortis pretium. Etiam tortor
              sem, tempus ac consequat sagittis, tincidunt in metus. Vestibulum ante ipsum primis in
              faucibus orci luctus et ultrices posuere cubilia curae; Nulla felis tortor, dictum
              eget euismod sed, lacinia in libero. Fusce mattis sem eu ligula condimentum pretium.
              Curabitur eu facilisis elit, a faucibus odio.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}>
                  Curabitur pulvinar cursus elementum. Proin finibus dui nunc, nec sodales ipsum
                  egestas eget. Mauris a rutrum tortor, mattis accumsan eros. Sed dictum semper
                  augue. Cras id sapien convallis, aliquam eros nec, volutpat lectus. Pellentesque
                  tempor nunc efficitur ante sodales sagittis. Proin fermentum mauris et dignissim
                  mattis. Nulla facilisi. Donec vel mauris vulputate, vulputate lorem molestie,
                  cursus tortor.
                </div>
                <div className={styles.blockStatstic}>
                  <NotImplementedBlockStatisticTitleRow title={<>TODO</>} />
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}>
                  Curabitur pulvinar cursus elementum. Proin finibus dui nunc, nec sodales ipsum
                  egestas eget. Mauris a rutrum tortor, mattis accumsan eros. Sed dictum semper
                  augue. Cras id sapien convallis, aliquam eros nec, volutpat lectus. Pellentesque
                  tempor nunc efficitur ante sodales sagittis. Proin fermentum mauris et dignissim
                  mattis. Nulla facilisi. Donec vel mauris vulputate, vulputate lorem molestie,
                  cursus tortor.
                </div>
                <div className={styles.blockStatstic}>
                  <NotImplementedBlockStatisticTitleRow title={<>TODO</>} />
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <AdminDashboardLargeChartPlaceholder />
            </SectionGraphs>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Message Receipts</div>
          <SectionDescription>
            <p>
              Note that SES does not store email information once the message was sent, so there is
              no backup to the webhook flow, should it fail. However, to mitigate this Amazon SES
              has an extensive and configurable retry policy, and our servers have a high quality
              connection to the SES servers (very low number of hops). This does not make dropping
              messages impossible (hence the abandoned flow), but it does make it unlikely.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus metus odio, aliquet
              vel bibendum et, malesuada non elit. Mauris dapibus dapibus sagittis. Ut fermentum
              justo bibendum, vehicula nunc ut, porttitor turpis. Aliquam nibh mi, finibus in
              vestibulum eget, sagittis id urna. Praesent semper, sapien ac suscipit semper, tortor
              tortor finibus est, eu vehicula dui nulla sit amet elit. Sed diam orci, lobortis a
              sapien quis, laoreet porttitor dui. Vivamus sit amet massa vitae tellus fermentum
              consectetur eu suscipit tortor. Cras sed mauris nec libero suscipit pellentesque.
            </p>
            <p>
              Duis efficitur est sit amet massa tincidunt, vel finibus sem bibendum. Mauris elit
              orci, accumsan vitae tempor id, commodo eget dolor. Praesent tellus purus, fringilla
              vel lectus quis, lacinia sodales metus. Mauris elementum quam eros, a scelerisque
              ligula euismod a. Cras pulvinar nisi sit amet sagittis varius. Nullam faucibus orci
              eget velit sodales pellentesque. Sed ullamcorper dui odio, eu lobortis lorem luctus
              quis. Donec tortor sem, dictum non dignissim vitae, efficitur eget nibh. Aliquam
              accumsan risus quis nibh interdum sagittis. Praesent dictum leo eu massa cursus, eget
              ornare quam malesuada. Aenean blandit eros quis ante lobortis pretium. Etiam tortor
              sem, tempus ac consequat sagittis, tincidunt in metus. Vestibulum ante ipsum primis in
              faucibus orci luctus et ultrices posuere cubilia curae; Nulla felis tortor, dictum
              eget euismod sed, lacinia in libero. Fusce mattis sem eu ligula condimentum pretium.
              Curabitur eu facilisis elit, a faucibus odio.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}>
                  Curabitur pulvinar cursus elementum. Proin finibus dui nunc, nec sodales ipsum
                  egestas eget. Mauris a rutrum tortor, mattis accumsan eros. Sed dictum semper
                  augue. Cras id sapien convallis, aliquam eros nec, volutpat lectus. Pellentesque
                  tempor nunc efficitur ante sodales sagittis. Proin fermentum mauris et dignissim
                  mattis. Nulla facilisi. Donec vel mauris vulputate, vulputate lorem molestie,
                  cursus tortor.
                </div>
                <div className={styles.blockStatstic}>
                  <NotImplementedBlockStatisticTitleRow title={<>TODO</>} />
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}>
                  Curabitur pulvinar cursus elementum. Proin finibus dui nunc, nec sodales ipsum
                  egestas eget. Mauris a rutrum tortor, mattis accumsan eros. Sed dictum semper
                  augue. Cras id sapien convallis, aliquam eros nec, volutpat lectus. Pellentesque
                  tempor nunc efficitur ante sodales sagittis. Proin fermentum mauris et dignissim
                  mattis. Nulla facilisi. Donec vel mauris vulputate, vulputate lorem molestie,
                  cursus tortor.
                </div>
                <div className={styles.blockStatstic}>
                  <NotImplementedBlockStatisticTitleRow title={<>TODO</>} />
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <AdminDashboardLargeChartPlaceholder />
            </SectionGraphs>
          </div>
        </div>
      </div>
    </div>
  );
};
