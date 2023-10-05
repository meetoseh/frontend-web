import { ReactElement } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import { SectionDescription } from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart } from '../../shared/components/flowchart/FlowChart';

export const AdminSignInWithOsehDashboard = (): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Sign in with Oseh Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Accounts</div>
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
                stores the JWT in local storage, meaning it is accessible to javascript for
                prefilling, etc
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
                stores the JWT within an http-only cookie, allowing for the CSRF token to be
                injected anywhere within or across the page and subresources to make extraction
                difficult
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
              <li>does not use cross-site request forgery tokens</li>
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
                uses cross-site request forgery tokens to hinder attempts at alternative frontends
              </li>
              <li>uses the strictest content-security-policy for a minimal attack surface</li>
              <li>has a web frontend built in plain javascript for a minimal attack surface</li>
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
                        When landing on Sign in with Oseh when not logged in, the first step is to
                        enter your email address. The frontend will check if a corresponding account
                        exists and direct you to the appropriate flow. The sign in with oseh
                        frontend will have a CSRF token, redirect url, and client id for the request
                        (along with the email address).
                      </p>
                      <p>
                        This endpoint can be used to scan for accounts, which is mitigated using
                        attack detection and an alternative response when an attack is detected. In
                        particular, when ratelimiting, rather than blocking the request, which would
                        interfere with both logging in and account creation for regular users, the
                        endpoint will require the user provide an email verification code before the
                        answer will be provided, thus preventing an attacker from scanning for
                        accounts. The attacker cannot know if we decide to actually send a
                        verification email or just silently drop the request, which allows for a
                        more flexible response to attacks.
                      </p>
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
                            Once the user knows a Sign in with Oseh identity exists for a particular
                            email address they are asked for their password to exchange for a JWT.
                            This JWT can be converted to a code to complete the standard
                            authorization flow. The frontend will also suggest next steps, e.g., if
                            the user has not verified their email address, it will suggest prompting
                            them to do so before exchanging the JWT.
                          </p>
                        </div>
                      </div>
                    ),
                    children: [],
                  },
                  {
                    element: (
                      <div className={styles.block} style={{ maxWidth: '600px' }}>
                        <div className={styles.blockTitle}>Create Account</div>
                        <div className={styles.blockDescription}>
                          <p>
                            Once the user knows a Sign in with Oseh identity does not exist for a
                            particular email address they can request that an account be created by
                            providing a password. Note that this step can also be used for scanning
                            for accounts, and hence needs to have that same attack mitigated. For
                            simplicity, the create account endpoint requires a secret returned by
                            the check account endpoint and which can only be used once, for the same
                            email address, and hence each create account request requires a matching
                            successful check account request. Thus, it is sufficient to just protect
                            the check account endpoint.
                          </p>
                          <p>
                            This endpoint immediately creates a Sign in with Oseh identity with an
                            unverified email address and returns a JWT which can be converted to a
                            code to complete the process. This means that the Sign in with Oseh
                            identity may provide unverified email addresses to the Oseh platform.
                            Fortunately this can be indicated in the claims the Oseh platform
                            receives when exchanging the code using Sign in with Oseh identity
                            provider, and knows not to trust the email address. Furthermore, email
                            addresses are not unique identifiers on the Oseh platform, so this does
                            not block or check for an existing user on the Oseh platform.
                          </p>
                        </div>
                      </div>
                    ),
                    children: [],
                  },
                ],
              }}
            />
          </div>
          TODO CHARTS
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Email Verifications</div>
          <SectionDescription>
            <p>
              This section handles how Sign in with Oseh identities get verified email addresses,
              since they are created with unverified email addresses.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart
              tree={{
                element: (
                  <div className={styles.block} style={{ maxWidth: '600px' }}>
                    <div className={styles.blockTitle}>Request Verification Email</div>
                    <div className={styles.blockDescription}>
                      <p>
                        The frontend can exchange a JWT and CSRF token to request a verification
                        email is sent to the email address of the respective identity. Since this
                        cannot be the same CSRF token that was used on the first request, this
                        implies a page refresh between the two requests.
                      </p>
                    </div>
                  </div>
                ),
                children: [
                  {
                    element: (
                      <div className={styles.block} style={{ maxWidth: '600px' }}>
                        <div className={styles.blockTitle}>Verify Email with Code</div>
                        <p>
                          The frontend can exchange a JWT, CSRF token, and verification code to
                          verify the email address of the respective identity. Since this cannot be
                          the same CSRF token that was used on the first request, this implies a
                          page refresh between the two requests.
                        </p>
                      </div>
                    ),
                    children: [],
                  },
                ],
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
