import { ReactElement } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import { SectionDescription } from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart } from '../../shared/components/flowchart/FlowChart';
import { combineClasses } from '../../shared/lib/combineClasses';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { NetworkChart } from '../lib/NetworkChart';

export const AdminSignInWithOsehDashboard = (): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Sign in with Oseh Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Sign in with Oseh JWT</div>
          <SectionDescription>
            <p>
              For users which do not want reuse an existing identity provider such as Google or
              Apple, we provide our own identity service. This identity service is interacted with
              in the same manner we interact with Sign in with Google or Sign in with Apple, meaning
              it implements a subset of the minimal{' '}
              <a href="https://openid.net/developers/how-connect-works/" rel="noreferrer">
                OpenID Connect protocol
              </a>
              .
            </p>
            <p>
              It is important to distinguish Sign in with Oseh from a user on the Oseh platform. A
              user on the Oseh platform:
            </p>
            <ul>
              <li>
                is authenticated using JWTs issued by the Oseh platform (the{' '}
                <span className={styles.mono}>iss</span> is{' '}
                <span className={styles.mono}>oseh</span> and the audience is{' '}
                <span className={styles.mono}>oseh-id</span>)
              </li>
              <li>
                receives the JWTs from the Oseh platform by exchanging a code from an identity
                associated with their user
              </li>
              <li>
                stores the JWT in local storage, meaning it is only sent when accessing privileged
                resources and thus non-privileged resources are cacheable
              </li>
              <li>
                can take classes, purchase Oseh+, and otherwise interact with the Oseh ecosystem
              </li>
              <li>has a history, library, etc, on the Oseh platform</li>
              <li>
                has an email address, name, can add phone numbers, etc. these can be filled in by
                the identity provider when exchanging a code, but may differ from those values
              </li>
            </ul>
            <p>Whereas, an identity on Sign in with Oseh:</p>
            <ul>
              <li>
                is authenticated using JWTs issued by Sign in with Oseh (the{' '}
                <span className={styles.mono}>iss</span> is{' '}
                <span className={styles.mono}>sign-in-with-oseh</span> and the audience is{' '}
                <span className={styles.mono}>sign-in-with-oseh</span>)
              </li>
              <li>
                receives the JWTs from Sign in with Oseh by providing an email address and password
              </li>
              <li>
                stores the JWT within an http-only cookie, so that the JWT is sent for even the
                HTML/JS files, meaning that the server has a lot of freedom when injecting and
                inspecting CSRF tokens (but making any caching impossible)
              </li>
              <li>can exchange JWTs from Sign in with Oseh for codes for the Oseh platform</li>
              <li>
                has a subset of{' '}
                <a
                  href="https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims"
                  rel="noreferrer">
                  standard OpenID connect core claims
                </a>
                , which includes email verification
              </li>
            </ul>
            <p>
              The simplest case is when a user creates an account by creating an identity with Sign
              in with Oseh and then exchanging that identity for an Oseh user account. However, a
              user can create an Oseh account without creating an identity with Sign in with
              Oseh&mdash;for example, by exchanging a Sign in with Google identity for an Oseh user
              account. Furthermore, a user can create an identity with Sign in with Oseh after the
              fact, to add another identity to their user on the Oseh platform. Additionally,
              it&rsquo;s possible for a Sign in with Oseh identity to be created without a user on
              the Oseh platform being created by aborting the exchange process. Finally, it&rsquo;s
              possible to delete a Sign in with Oseh identity without deleting the corresponding
              user on the Oseh platform, and vice-versa.
            </p>
            <p>
              The Oseh platform does not support email verification. Instead, in order to verify an
              email address the user must exchange a code from an identity provider whose email
              address is verified. Sign in with Google and Sign in with Apple essentially always
              provide verified email addresses, but for a user account to have a verified email
              outside of the external identity providers they must create an identity with Sign in
              with Oseh, and go through the email verification process on Sign in with Oseh.
            </p>
            <p>
              Prompting for a user to verify an email address within the Oseh platform will direct
              the user to Sign in with Oseh.
            </p>
            <p>
              The Oseh platform and Sign in with Oseh are built differently given their differing
              responsibilities. The Oseh Platform...
            </p>
            <ul>
              <li>supports multiple frontends</li>
              <li>
                has a web frontend built in React via{' '}
                <span className={styles.mono}>create-react-app</span> for a great developer
                experience
              </li>
              <li>
                has mobile frontends built in React via{' '}
                <span className={styles.mono}>react-native</span> for a great developer experience
              </li>
              <li>
                does not use cross-site request forgery tokens, improving performance and allowing
                for better interopability
              </li>
              <li>
                uses a moderate content-security-policy to improve performance and developer
                experience while hindering basic attacks
              </li>
              <li>allows for third-party integrations</li>
            </ul>
            <p>On the contract, Sign in with Oseh</p>
            <ul>
              <li>supports only one frontend</li>
              <li>
                uses cross-site request forgery tokens for frustrating attempts to build alternative
                frontends but costing a significant performance penalty
              </li>
              <li>
                uses the strictest content-security-policy for a minimal attack surface but costing
                a small performance penalty
              </li>
              <li>
                has a web frontend built in plain javascript for a minimal attack surface but
                costing a significant development time penalty
              </li>
            </ul>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart
              tree={{
                element: (
                  <div className={styles.block} style={{ maxWidth: '600px' }}>
                    <div className={styles.blockTitle}>Check Account</div>
                    <div className={styles.blockDescription}>
                      <p>
                        When the user clicks "Continue with Email" on the Oseh platform, they are
                        redirected to the Sign in with Oseh authorize page with a redirect url and
                        client ID in the query parameters.
                      </p>
                      <p>
                        The authorize page has a CSRF token injected server-side and asks the user
                        to enter their email address. The authorize page will then ask the backend
                        to exchange the redirect url, client ID, CSRF token, and email address for a
                        Login JWT and if an identity with that email address exists in Sign in with
                        Oseh. The Login JWT will have the email, redirect url, client ID, and
                        existence check result embedded.
                      </p>
                    </div>
                  </div>
                ),
                children: [
                  {
                    element: (
                      <div className={styles.block} style={{ maxWidth: '600px' }}>
                        <div className={styles.blockTitle}>Security Check</div>
                        <div className={styles.blockDescription}>
                          <p>
                            The backend will either return the requested Login JWT and existence
                            check <em>or</em> an Elevation JWT which can be used to request an email
                            verification code for that email address, which means that an email
                            verification code must be provided to check that email address.
                          </p>
                          <p>
                            If the backend requires an email verification code then the frontend
                            asks the user if they want to receive the code, and assuming they affirm
                            the request, acknowledges the security elevation on the backend to
                            trigger the email being sent and requests the code from user. Once the
                            code is available, the frontend redoes the check account api call with
                            the provided code.
                          </p>
                          <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                            An email verification code is requested during the check account step in
                            place of ratelimiting requests when unusual activity is detected, such
                            as a much larger than average volume of requests.
                          </div>
                          <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                            We target a less than 1e-7 chance to guess a code before it expires,
                            resulting in 7-character codes that last 30 minutes and require at least
                            9s between attempts. When creating a code for an email, previous codes
                            are revoked.
                          </div>
                          <TogglableSmoothExpandable
                            expandCTA="Show ratelimit calculation"
                            noAnimate>
                            <p>
                              Let <strong>D</strong> be the duration of the code in seconds,{' '}
                              <strong>d</strong> be the enforced minimum time between attempts in
                              seconds, and <strong>c</strong> be the complexity of the code in bits.
                            </p>
                            <p>
                              Thus, the chance of guessing the code in the first attempt is{' '}
                              <span className={styles.mono}>P(guess in 1) = 1/(2^c)</span>. The
                              chance of guessing the code in <strong>n</strong> attempts is the
                              chance that any of the <strong>n</strong> attempts were correct, i.e.,
                              1 - the chance that all of the <strong>n</strong> attempts were wrong,
                              i.e.,{' '}
                              <span className={styles.mono}>
                                P(guess in n) = 1 - (1 - 1/(2^c))^n
                              </span>
                            </p>
                            <p>
                              Note this assumes replacement, but given that the number of
                              possibilities is much larger than the maximum number of attempts, the
                              chance without replacement is approximately the same.
                            </p>
                            <p>
                              There are <span className={styles.mono}>D/d</span> possible attempts
                              per code, hence,{' '}
                              <span className={styles.mono}>
                                P(guess in D/d) = 1 - (1 - 1/(2^c))^(D/d)
                              </span>
                            </p>
                            <p>
                              Solving for <span className={styles.mono}>d</span> given the above can
                              then be done in wolfram alpha or similar. We can select the complexity
                              by using either more characters, more characters, or both. We choose
                              the following case-insensitive alphabet to avoid confusing characters:{' '}
                              <span className={styles.mono}>2345689cdefhjkmnprtvwxy</span>, giving
                              23 options. Thus, the bits of entropy is{' '}
                              <span className={styles.mono}>c = floor(log2(23^n))</span> where{' '}
                              <span className={styles.mono}>n</span> is the number of characters.
                            </p>
                            <p>
                              For example, for a target of 1e-12,{' '}
                              <span className={styles.mono}>D=10*60</span>,{' '}
                              <span className={styles.mono}>n=10</span> which gives{' '}
                              <span className={styles.mono}>c=45</span> will solve to{' '}
                              <span className={styles.mono}>d=17.0534</span>, which we ceil to 18s
                              per attempt.
                            </p>
                          </TogglableSmoothExpandable>
                        </div>
                      </div>
                    ),
                    children: [
                      {
                        element: (
                          <div className={styles.block} style={{ maxWidth: '600px' }}>
                            <div className={styles.blockTitle}>Login to Account</div>
                            <div className={styles.blockDescription}>
                              <p>
                                A Login JWT whose email address corresponds to an existing identity
                                and the current password of that identity can be exchanged for a
                                Sign in with Oseh JWT.
                              </p>
                              <p>
                                To guard against brute force attacks, the backend will ratelimit
                                each Login JWT individually to a maximum rate of unique password
                                attempts. Repeated passwords are detected by hashing the password
                                with an OWASP approved difficulty and the Login JWT JTI as the salt
                                and storing the result in an redis key set to expire just after the
                                Login JWT expires. Not limiting repeated attempts reduces user
                                frustration without hindering our protection against brute force
                                attacks.
                              </p>
                              <div
                                className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                                To <strong>exchange the Login JWT</strong> means the Login JWT is{' '}
                                <strong>revoked</strong> as a result of the request. In this case,
                                the Login JWT is only revoked if the request succeeds.
                              </div>
                            </div>
                          </div>
                        ),
                        children: [],
                      },
                      {
                        element: (
                          <div className={styles.block} style={{ maxWidth: '600px' }}>
                            <div className={styles.blockTitle}>Create Identity</div>
                            <div className={styles.blockDescription}>
                              <p>
                                A Login JWT whose email address does not correspond to an existing
                                identity and a new password can be exchanged to create a Sign in
                                with Oseh identity and receive a Sign in with Oseh JWT for that new
                                identity.
                              </p>
                              <div
                                className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                                If the user did not complete the email verification security check
                                when creating the Login JWT, the new Sign in with Oseh identity will
                                have an unverified email address.
                              </div>
                              <div
                                className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                                The Login JWT is always revoked by this endpoint, regardless of
                                success.
                              </div>
                            </div>
                          </div>
                        ),
                        children: [],
                      },
                      {
                        element: (
                          <div className={styles.block} style={{ maxWidth: '600px' }}>
                            <div className={styles.blockTitle}>Request Reset Password Code</div>
                            <div className={styles.blockDescription}>
                              <p>
                                A Login JWT whose email address corresponds to an existing identity
                                can be exchanged to request a password reset email be sent to that
                                account. This email will contain a link to{' '}
                                <span className={styles.mono}>/reset-password</span> with a Reset
                                Password Code as a query parameter.
                              </p>

                              <div
                                className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                                It&rsquo;s a little weird to require two emails if the user had to
                                do a security check, but it&rsquo;s a rather unlikely scenario and
                                the security check email uses too little entropy to be used as a
                                reset password mechanism.
                              </div>

                              <div
                                className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                                Here we use 512 bits of entropy and limit to 1 attempt per 15s with
                                a 30 minute expiry, for a guess chance per code of less than 1e-152
                                (for reference, if I selected an atom in the known universe
                                uniformly at random, your chance of guessing which one I chose on
                                your first try is about 1e-80)
                              </div>
                            </div>
                          </div>
                        ),
                        children: [
                          {
                            element: (
                              <div className={styles.block} style={{ maxWidth: '600px' }}>
                                <div className={styles.blockTitle}>Complete Reset Password</div>
                                <div className={styles.blockDescription}>
                                  <p>
                                    A Reset Password Code, CSRF token, and a new password can be
                                    exchanged for a Login JWT for the corresponding identity. When
                                    this exchange occurs, the password for the corresponding
                                    identity is updated.
                                  </p>
                                  <div
                                    className={combineClasses(
                                      styles.blockNote,
                                      styles.blockNoteInfo
                                    )}>
                                    This endpoint is not guarded by a Login JWT. Hence it requires a
                                    CSRF token and has its own global ratelimiting. It&rsquo;s less
                                    of an issue if users are blocked from resetting their password
                                    than for signing up or logging in, hence simple ratelimiting is
                                    appropriate here.
                                  </div>
                                  <div
                                    className={combineClasses(
                                      styles.blockNote,
                                      styles.blockNoteInfo
                                    )}>
                                    This provides a Login JWT instead of a Sign in with Oseh JWT in
                                    order to require the user enter their password again in the
                                    hopes that this time it will be properly stored in a password
                                    manager.
                                  </div>
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
                  <div className={styles.block} style={{ maxWidth: '600px' }}>
                    <div className={styles.blockTitle}>Queue Delayed Email Verification</div>
                    <div className={styles.blockDescription}>
                      <p>
                        When Sign in with Oseh detects what is likely a real person creating many
                        fake accounts, probably to abuse a later endpoint, security checks will
                        trigger and to deter that person we will delay sending the email
                        verification code. Furthermore, some of the emails we send them will contain
                        a bogus code forcing them to repeat the process.
                      </p>
                      <p>
                        To accomplish this, rather than adding the email directly to the Email To
                        Send Queue, it is added to a similar redis list we call the Delayed Email
                        Verification Queue which has the same data but for which queued at might be
                        in the future.
                      </p>
                      <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                        TODO: size of queue, oldest due at
                      </div>
                    </div>
                  </div>
                ),
                children: [
                  {
                    element: (
                      <div className={styles.block} style={{ maxWidth: '600px' }}>
                        <div className={styles.blockTitle}>Send Delayed Email Verification Job</div>
                        <div className={styles.blockDescription}>
                          About once a minute, the Send Delayed Email Verification Job will move
                          overdue emails from the Delayed Email Verification Queue to the Email To
                          Send Queue
                          <div
                            className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                            TODO: started at, finished at, running time, num moved, stop reason
                            (incl backpressure)
                          </div>
                        </div>
                      </div>
                    ),
                    children: [],
                  },
                ],
              }}
            />
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/siwo/partial_siwo_authorize_stats"
            historicalDataPath="/api/1/admin/siwo/siwo_authorize_stats"
          />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Email Verifications</div>
          <SectionDescription>
            <p>
              This section handles how Sign in with Oseh identities get verified email addresses,
              since they are created with unverified email addresses. The Sign in with Oseh JWTs
              always come with if the email is verified or not so the client can decide to prompt
              the user.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart
              tree={{
                element: (
                  <div className={styles.block} style={{ maxWidth: '500px' }}>
                    <div className={styles.blockTitle}>Request Verification Email</div>
                    <div className={styles.blockDescription}>
                      <p>
                        The frontend can use a Sign in with Oseh JWT to request a verification email
                        is sent to the email address of the respective identity. The verification
                        email is formatted similarly to the Security Check email from the previous
                        section and contains a code in it that can be entered into the frontend
                        rather than a link.
                      </p>
                      <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                        Basic per-identity ratelimiting is applied to this endpoint to ensure only 1
                        code is active at a time.
                      </div>
                    </div>
                  </div>
                ),
                children: [
                  {
                    element: (
                      <div className={styles.block} style={{ maxWidth: '500px' }}>
                        <div className={styles.blockTitle}>Verify Email with Code</div>
                        <p>
                          The frontend can use a Sign in with Oseh JWT and verification code to
                          verify the email address of the respective identity. Since this cannot be
                          the same CSRF token that was used on the first request, this implies a
                          page refresh between the two requests.
                        </p>
                        <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                          Basic per-identity ratelimiting is applied to this endpoint such that
                          there is a less than 1e-7 chance of guessing the code before it expires
                          when using the maximum number of attempts.
                        </div>
                      </div>
                    ),
                    children: [],
                  },
                ],
              }}
            />
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/siwo/partial_siwo_verify_email_stats"
            historicalDataPath="/api/1/admin/siwo/siwo_verify_email_stats"
          />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Codes</div>
          <SectionDescription>
            <p>
              This section handles how Sign in with Oseh identities are exchanged for codes that can
              be used to get Oseh platform JWTs.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart
              tree={{
                element: (
                  <div className={styles.block}>
                    <div className={styles.blockTitle}>Exchange JWT for Code</div>
                    <div className={styles.blockDescription}>
                      In order to complete the authorization process, the frontend exchanges a Sign
                      in with Oseh JWT for a code which can be exchanged with the Oseh platform for
                      an Oseh JWT.
                    </div>
                  </div>
                ),
                children: [],
              }}
            />
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/siwo/partial_siwo_exchange_stats"
            historicalDataPath="/api/1/admin/siwo/siwo_exchange_stats"
          />
        </div>
      </div>
    </div>
  );
};
