import { ReactElement, useMemo } from 'react';
import { OauthProvider } from '../../../../login/lib/OauthProvider';
import {
  ButtonWithIcon,
  ButtonsWithIconsColumn,
} from '../../../../../shared/components/ButtonsWithIconsColumn';
import styles from './ProvidersList.module.css';

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

/**
 * Displays a list of providers using the standard spacing and button
 * variant.
 */
export const ProvidersList = ({ items }: ProvidersListProps): ReactElement => {
  const buttons = useMemo(
    () =>
      items.map(
        ({ provider, onClick, onLinkClick }): ButtonWithIcon => ({
          key: provider,
          icon: <span className={styles['icon' + provider]} />,
          name: {
            Google: 'Sign in with Google',
            SignInWithApple: 'Sign in with Apple',
            Direct: 'Sign in with Email',
            Dev: 'Sign in with Dev',
          }[provider],
          onClick,
          onLinkClick,
        })
      ),
    [items]
  );

  return <ButtonsWithIconsColumn items={buttons} variant="filled-white" gap={20} />;
};
