import { ReactElement, useMemo } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import {
  NotImplementedBlockStatisticTitleRow,
  SectionDescription,
  SectionGraphs,
} from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { AdminDashboardLargeChartPlaceholder } from '../dashboard/AdminDashboardLargeChartPlaceholder';
import { combineClasses } from '../../shared/lib/combineClasses';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { ReceiveWebhookBlockStatistics } from '../sms_dashboard/AdminSMSDashboard';
import { createWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { PartialStats, parsePartialStats } from '../lib/PartialStats';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 48 },
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
  const webhookStats = useMemo(() => {
    const result = createWritableValueWithCallbacks<PartialStats>(
      parsePartialStats({
        today: {
          received: 0,
          verified: 0,
          accepted: 0,
          unprocessable: 0,
          signature_missing: 0,
          signature_invalid: 0,
          body_read_error: 0,
          body_max_size_exceeded_error: 0,
          body_parse_error: 0,
        },
        yesterday: {
          received: 1,
          verified: 0,
          accepted: 1,
          unprocessable: 0,
          signature_missing: 0,
          signature_invalid: 0,
          body_read_error: 0,
          body_max_size_exceeded_error: 0,
          body_parse_error: 0,
        },
      })
    );
    const error = createWritableValueWithCallbacks<ReactElement | null>(null);

    return {
      result,
      error,
      refresh: () => Promise.resolve(),
    };
  }, []);

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
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Messages</div>
          <SectionDescription>
            <p>
              We use{' '}
              <a href="https://aws.amazon.com/ses/" rel="noreferrer">
                Amazon SES
              </a>{' '}
              as our email service provider. Thus, to send notifications we use the{' '}
              <a
                href="https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sesv2.html"
                rel="noreferrer">
                SESV2 client
              </a>
              , primarily the{' '}
              <a
                href="https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sesv2/client/send_email.html"
                rel="noreferrer">
                send_email
              </a>{' '}
              endpoint. Note that there is also a{' '}
              <a
                href="https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sesv2/client/send_bulk_email.html"
                rel="noreferrer">
                send_builk_email
              </a>{' '}
              endpoint, but it requires using{' '}
              <a
                href="https://docs.aws.amazon.com/ses/latest/dg/send-personalized-email-api.html"
                rel="noreferrer">
                Amazon's templates
              </a>{' '}
              which render using a template based on the{' '}
              <a href="https://handlebarsjs.com/" rel="noreferrer">
                handlebars
              </a>{' '}
              templating language, which is powerful but still entirely inferior to React.
            </p>
            <p>
              Thus, we have one-at-a-time email queueing, but fortunately Amazon SES is very close
              to our servers (indeed, they are located within the same region and have availability
              zone cross-over). Nonetheless, using{' '}
              <a
                href="https://boto3.amazonaws.com/v1/documentation/api/latest/index.html"
                rel="noreferer">
                boto3
              </a>{' '}
              has some surprising reliability issues. Two common error types (&gt;10 per day) are{' '}
              <span className={styles.mono}>botocore.exceptions.NoCredentialsError</span> and{' '}
              excessively long requests (&gt;2 minutes, &lt;5 minutes), which can trigger timeouts
              if we&rsquo;re not careful. The first is because boto3 requests credentials via the
              IAM system which goes down for a few seconds whenever it is updated, and the second is
              due to boto3's large default timeouts and large number of retries. To mitigate the
              second, we disable boto3 client retrying, prefering to retry ourselves on the next job
              run rather than stalling the current job.
            </p>
            <p>
              There are two primary restrictions on how quickly emails can be sent to Amazon SES.
              One is a daily quota, 50,000 emails per 24-hour period, and the other is a
              minimum-spacing quota of about 72ms/email. The latter is a result of the sending rate
              restriction (14/second) with insufficient documentation to determine the allowed burst
              rate.
            </p>
            <p>
              We approximate these two quotas on our side in order to self-ratelimit rather than
              receive errors from Amazon. The first is changed to 50,000 emails per day (a ~24-hour
              period starting at midnight America/Los_Angeles) and tracked using our normal send
              statistics monitoring, and the second as 72ms/email tracked using a basic redis key
              containing the earliest time at which another email can be sent, checked and
              incremented just prior to starting a send.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Start Send Email</div>
                <div className={styles.blockDescription}>
                  This flow is triggered when we want to send an email to an email address. At this
                  point, we have:
                  <ul>
                    <li>The recipient&rsquo;s email address</li>
                    <li>The template slug</li>
                    <li>The template parameters</li>
                  </ul>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    Email addresses must only have 7-bit ASCII in the local part of the email
                    address (preceeding the @). If the domain part of the address (after the @)
                    contains non-ASCII characters, they must be encoded using Punycode
                  </div>
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Append to Send Queue</div>
                <div className={styles.blockDescription}>
                  We augment the message attempt with some basic metadata (uid, timestamp, retries,
                  success job, failure job, etc) and push it to the right of the redis list we refer
                  to as the "To Send" queue as a json, utf-8 encoded string.
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># In To Send</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Oldest Item</>} />
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Send Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About four times per minute we pull messages off the To Send queue, moving them
                    to the Send Purgatory, then convert the template slug and parameters to final
                    format, then send those to Amazon SES in an encrypted and authorized request. If
                    successful, the message is removed from the Send Purgatory and added to the
                    Receipt Pending Set.
                  </p>

                  <p>
                    The job continues until there are either no more messages to send or 50s have
                    passed.
                  </p>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                    boto3 uses a connection pooling strategy similar to requests, which does a
                    rather poor job reusing connections.
                  </div>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    If the send job is due while a previous run is still in progress, it will be
                    skipped.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># In Purgatory</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Started At</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Finished At</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Running Time</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Attempted</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Templated</>} />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      Of the messages attempted, how many were we able to convert into the final
                      formats (HTML and plaintext) using the template and template parameters via
                      the email-templates server.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Accepted</>} />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      Of the messages templated, how many did Amazon SES accept and return a
                      MessageId that could be added to the Receipt Pending Set. This does not
                      necessarily mean that the message delivery was or will be attempted, nor that
                      message was delivered.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Failed Permanently</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Failed Transiently</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Stop Reason</>} />
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <AdminDashboardLargeChartPlaceholder placeholderText="Queued, attempted, templated, accepted, failures by type, all by day" />
            </SectionGraphs>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Message Receipts</div>
          <SectionDescription>
            <p>
              After an email is received by SES it may attempt to deliver it. The result of the
              delivery attempt is sent to us via an{' '}
              <a href="https://aws.amazon.com/sns/" rel="noreferrer">
                SNS
              </a>{' '}
              notification. That notification is then delivered to us via a webhook due to our
              subscription to the corresponding{' '}
              <a
                href="https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications.html"
                rel="noreferrer">
                topic
              </a>
              . There are three outcomes that we are notified about, for which more information on
              the negative options can be found{' '}
              <a
                href="https://aws.amazon.com/blogs/messaging-and-targeting/handling-bounces-and-complaints/"
                rel="noreferrer">
                here
              </a>
              .
            </p>
            <ul>
              <li>
                Bounce: A permanent bounce indicates we should never attempt to contact that
                recipient again (ex: a deleted account, since email addresses are not ever reused).
                A transient bounce indicates that we can retry delivery in the future but this email
                was not accepted, for example, the account does not exist or the message was too
                large.
              </li>
              <li>
                Complaint: The recipient does not want the email we sent them, and we should never
                attempt to contact them again unless they explicitly, unambiguously request it. This
                can be after a successful delivery, including after a substantial delay.
              </li>
              <li>Delivery: The recipient received the email.</li>
            </ul>
            <p>
              SES does not store email information once the message was sent, so there is no backup
              to the webhook flow, should it fail. However, to mitigate this Amazon SES has an
              extensive and configurable retry policy, and our servers have a high quality
              connection to the SES servers (very low number of hops). This does not make dropping
              messages impossible, but it does make it unlikely.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Receive Webhook</div>
                <div className={styles.blockDescription}>
                  <p>
                    When an email is delivered, bounces, or a complaint is received, eventually a
                    webhook will be received by our servers. This webhook includes at least the
                    notification type (Bounce, Complaint, or Delivery), the recipient email address,
                    and the message id.
                  </p>
                  <p>
                    The webhook is encrypted (via TLS) and signed. We decrypt the message, verify
                    the signature, and forward a simplified version of the event to the redis list
                    we call the Event Queue.
                  </p>
                  <p>
                    We track how many webhook requests we received today and yesterday to help
                    identify any issues with the webhook flow, but then the data is discarded as the
                    only notable datapoint (how many successful webhooks were received) can be
                    understood from the reconciliation stats (the graph in this section).
                  </p>
                </div>
                <ReceiveWebhookBlockStatistics webhookStats={webhookStats} />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Append to Event Queue</div>
                <div className={styles.blockDescription}>
                  When we receive verifiable information about an email from Amazon SES (via SNS),
                  it&rsquo;s appending to the redis list we call the event queue prior to further
                  processing. This is primarily to shift the processing load from web workers to the
                  job workers. The main information available is:
                  <ul>
                    <li>The notification type (Bounce, Complaint, or Delivery)</li>
                    <li>The recipient email address</li>
                    <li>The message id</li>
                    <li>When the event was received (primarily for logging)</li>
                  </ul>
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># In Event Queue</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Oldest Item</>} />
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Receipt Reconciliation Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute we pull items one at a time from the event queue, and then
                    checks if the corresponding message id is in the Receipt Pending Set. Then all
                    of the following occurs independently:
                  </p>
                  <ul>
                    <li>
                      If the notification is delivery and the message is in the Receipt Pending Set,
                      the success job is queued
                    </li>
                    <li>
                      If the notification is not delivery and the message is in the Receipt Pending
                      Set, the failure job is queued
                    </li>
                    <li>If the message is in the Receipt Pending Set, it is removed</li>
                    <li>If the notification is Complaint, the generic complaint job is queued</li>
                  </ul>
                  <p>
                    This uses a purgatory list for the currently processing event, though it should
                    only have 0 or 1 items in it at a time as we do not currently parallelize this
                    job.
                  </p>
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># In Purgatory</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Started At</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Finished At</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Running Time</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Attempted</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Success and Found</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Success but Abandoned</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Bounce and Found</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Bounce but Abandoned</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Complaint and Found</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Complaint and Abandoned</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Stop Reason</>} />
                </div>
              </div>
            </FlowChart>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '500px' }}>
                <div className={styles.blockTitle}>Stale Receipt Detection Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, we pull old (&gt;24 hours) messages off the Receipt
                    Pending Set, which is in redis, trigger their failure job, and delete them.
                    Complaint notifications can be received after an arbitrary delay, so instead of
                    using the failure job we use a generic handler.
                  </p>
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Started At</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Finished At</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Running Time</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<># Abandoned</>} />
                </div>
                <div className={styles.blockStatistic}>
                  <NotImplementedBlockStatisticTitleRow title={<>Stop Reason</>} />
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <AdminDashboardLargeChartPlaceholder placeholderText="Received, attempted, notifications by type & found/abandoned, all by day" />
            </SectionGraphs>
          </div>
        </div>
      </div>
    </div>
  );
};
