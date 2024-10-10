import styles from './OsehStyles.module.css';
import assistiveStyles from './assistive.module.css';

/**
 * The core styles that are used within Oseh.
 */
export const OsehStyles = {
  /** children layout styles */
  layout: {
    /** A flex column with justify-content start and align-items stretch */
    column: styles.layout__column,
    /** A flex row with justify-content start and align-items center */
    row: styles.layout__row,
    /** A flex row with justify-content start, align-items center, and flex-wrap 1 */
    rowWrap: styles.layout__rowWrap,
    /** allows vertically stacking components such that the last in the dom renders on top */
    stacking: {
      /**
       * the container that the inner ones position to match.
       * - all children must be `layout.stacking.child`
       * - usually has the width and height set to fixed values via style attribute
       */
      container: styles.layout__stacking__container,
      /** the inner components that stack. should generally have another layout class as well */
      child: styles.layout__stacking__child,
    },
  },
  /** Set the color attribute to the standard Oseh colors */
  colors: {
    v4: {
      primary: {
        /** #FFFFFF */
        white: styles.colors__v4__primary__white,
        /** #EAEAEB */
        light: styles.colors__v4__primary__light,
        /** #C8CDD0 */
        smoke: styles.colors__v4__primary__smoke,
        /** #8B8E90 */
        grey: styles.colors__v4__primary__grey,
        /** #383838 */
        darkGrey: styles.colors__v4__primary__darkGrey,
        /** #232323 */
        charcoal: styles.colors__v4__primary__charcoal,
        /** #191C1D */
        dark: styles.colors__v4__primary__dark,
      },
      experimental: {
        /** #35383A */
        lessDarkGrey: styles.colors__v4__experimental__lessDarkGrey,
        /** #EBADAD */
        lightError: styles.colors__v4__experimental__lightError,
        /** rgba(255, 255, 255, 0.05) */
        lighten5: styles.colors__v4__experimental__lighten5,
      },
      other: {
        /** #C83030 */
        red: styles.colors__v4__other__red,
        /** #40A797 */
        green: styles.colors__v4__other__green,
      },
    },
  },
  /** Set the font style, font weight, font-size, and line-height properties */
  typography: {
    /** 28px size, 33.6px line-height, 400 weight */
    h1: styles.typography__h1,
    /** 28px size, 33.6px line-height, 600 weight */
    h1Semibold: styles.typography__h1Semibold,
    /** 22px size, 28.6px line-height, 400 weight */
    h2: styles.typography__h2,
    /** 22px size, 28.6px line-height, 600 weight */
    h2Semibold: styles.typography__h2Semibold,
    /** 20px size, 24px line-height, 400 weight */
    h3: styles.typography__h3,
    /** 20px size, 24px line-height, 600 weight */
    h3Semibold: styles.typography__h3Semibold,
    /** 17px size, 22.1px line-height, 400 weight */
    title: styles.typography__title,
    /** 17px size, 22.1px line-height, 600 weight */
    titleSemibold: styles.typography__titleSemibold,
    /** 18px size, 27px line-height, 400 weight */
    bodyLarge: styles.typography__bodyLarge,
    /** 16px size, 24px line-height, 400 weight */
    body: styles.typography__body,
    /** 14px size, 16.8px line-height, 400 weight */
    detail1: styles.typography__detail1,
    /** 12px size, 15.6px line-height, 400 weight */
    detail2: styles.typography__detail2,
    /** 10px size, 13px line-height, 400 weight */
    detail3: styles.typography__detail3,
  },
  /** Used for screen readers */
  assistive: {
    /** show for screen readers only */
    srOnly: assistiveStyles.srOnly,
  },
  /** Used for normalizing types to act like a standard layout component */
  unstyling: {
    /** Can be applied to a <button> to get something that acts like layout.column */
    buttonAsColumn: styles.unstyling__buttonAsColumn,
  },
};
