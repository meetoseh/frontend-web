import { Fragment, ReactElement } from 'react';
import { ScreenTextContentMapped } from '../models/ScreenTextContentMapped';
import styles from './ScreenTextContent.module.css';
import { VerticalSpacer } from '../../../shared/components/VerticalSpacer';
import { HorizontalSpacer } from '../../../shared/components/HorizontalSpacer';
import { Check } from '../../../shared/components/icons/Check';
import { OsehColors } from '../../../shared/OsehColors';

/**
 * Renders the given screen text content. Assumes this is being rendered
 * into a flexbox container, column direction, align-items: stretch
 */
export const ScreenTextContent = ({
  content,
}: {
  content: ScreenTextContentMapped;
}): ReactElement => {
  return (
    <>
      {content.parts.map((part, i) => {
        switch (part.type) {
          case 'header':
            return (
              <div key={i} className={styles.header}>
                {part.value}
              </div>
            );
          case 'body':
            return (
              <div key={i} className={styles.body}>
                {part.value}
              </div>
            );
          case 'check':
            return (
              <div key={i} className={styles.check}>
                <Check
                  icon={{
                    width: 20,
                  }}
                  container={{
                    width: 20,
                    height: 20,
                  }}
                  startPadding={{
                    x: {
                      fraction: 0.5,
                    },
                    y: {
                      fraction: 0.5,
                    },
                  }}
                  color={OsehColors.v4.primary.light}
                />
                <HorizontalSpacer width={16} />
                <div className={styles.body}>{part.message}</div>
              </div>
            );
          case 'spacer':
            return <VerticalSpacer key={i} height={part.pixels} />;
        }
        return <Fragment key={i} />;
      })}
    </>
  );
};
