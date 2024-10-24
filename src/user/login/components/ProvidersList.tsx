import { ReactElement, useMemo } from 'react';
import { OauthProvider } from '../lib/OauthProvider';
import {
  ButtonWithIcon,
  ButtonsWithIconsColumn,
} from '../../../shared/components/ButtonsWithIconsColumn';
import { Google } from '../../../shared/components/icons/Google';
import { OsehColors } from '../../../shared/OsehColors';
import { Apple } from '../../../shared/components/icons/Apple';
import { Email } from '../../../shared/components/icons/Email';
import { Anonymous } from '../../../shared/components/icons/Anonymous';
import { Passkey } from '../../../shared/components/icons/Passkey';

/**
 * An item within a providers list, which is analogous to an item within
 * a ButtonsWithIconsColumn, but the name and icon can be inferred from
 * the provider.
 */
export type ProvidersListItem = {
  /**
   * The provider to use for this item.
   */
  provider: OauthProvider;

  /** If true, we de-emphasize this provider */
  deemphasize?: boolean;

  /**
   * Either the function to call when the button is clicked, or a string
   * for the href of an anchor tag. Generally a string should be used if
   * the user will be immediately redirected, whereas a function is used
   * if a modal will be displayed first
   */
  onClick: string | (() => void);

  /**
   * Ignored unless onClick is a string. If onClick is a string,
   * this is called on a best-effort basis when the link is clicked
   * but before the user is redirected. Note that the user may be
   * redirected at any point, so this generally has just enough time
   * to send a beacon or cleanup local storage, but not enough time
   * to e.g. wait for a response on a network request
   */
  onLinkClick?: () => void;
};

export type ProvidersListProps = {
  /**
   * The buttons to be rendered in the column
   */
  items: ProvidersListItem[];
};

export const LOGIN_ICONS_BY_PROVIDER: Record<OauthProvider, (color?: string) => ReactElement> = {
  Google: (color) => (
    <Google
      icon={{
        width: 18,
      }}
      container={{
        width: 32,
        height: 20,
      }}
      startPadding={{
        x: {
          fixed: 1,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={color ?? OsehColors.v4.primary.dark}
    />
  ),
  SignInWithApple: (color) => (
    <Apple
      icon={{
        width: 18,
      }}
      container={{
        width: 32,
        height: 20,
      }}
      startPadding={{
        x: {
          fixed: 1,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={color ?? OsehColors.v4.primary.dark}
    />
  ),
  Direct: (color) => (
    <Email
      icon={{
        width: 20,
      }}
      container={{
        width: 32,
        height: 20,
      }}
      startPadding={{
        x: {
          fraction: 0,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={color ?? OsehColors.v4.primary.dark}
    />
  ),
  Dev: (color) => (
    <Email
      icon={{
        width: 20,
      }}
      container={{
        width: 32,
        height: 20,
      }}
      startPadding={{
        x: {
          fraction: 0,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={color ?? OsehColors.v4.primary.dark}
    />
  ),
  Silent: (color) => (
    <Anonymous
      icon={{
        width: 20,
      }}
      container={{
        width: 32,
        height: 20,
      }}
      startPadding={{
        x: {
          fixed: 60,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={color ?? OsehColors.v4.primary.dark}
    />
  ),
  Passkey: (color) => (
    <Passkey
      icon={{
        width: 20,
      }}
      container={{
        width: 32,
        height: 20,
      }}
      startPadding={{
        x: {
          fraction: 0,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={color ?? OsehColors.v4.primary.dark}
    />
  ),
};

export const LOGIN_NAMES_BY_PROVIDER: Record<OauthProvider, string> = {
  Google: 'Sign in with Google',
  SignInWithApple: 'Sign in with Apple',
  Direct: 'Sign in with Email',
  Dev: 'Sign in as Developer',
  Silent: 'Sign in later',
  Passkey: 'Sign in with Passkey',
};

/**
 * Displays a list of providers using the standard spacing and button
 * variant.
 */
export const ProvidersList = ({ items }: ProvidersListProps): ReactElement => {
  const buttons = useMemo(
    () =>
      items.map(
        ({ provider, onClick, deemphasize, onLinkClick }): ButtonWithIcon => ({
          key: provider,
          icon: LOGIN_ICONS_BY_PROVIDER[provider](
            deemphasize ? OsehColors.v4.primary.light : undefined
          ),
          buttonVariant: deemphasize ? 'outlined-white' : undefined,
          name: LOGIN_NAMES_BY_PROVIDER[provider],
          onClick,
          onLinkClick,
        })
      ),
    [items]
  );

  return <ButtonsWithIconsColumn items={buttons} variant="filled-white" gap={20} />;
};
