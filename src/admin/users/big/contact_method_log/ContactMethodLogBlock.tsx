import { ReactElement } from 'react';
import { ContactMethodLog } from './ContactMethodLog';
import { CrudItemBlock } from '../../../crud/CrudItemBlock';
import { CrudFormElement } from '../../../crud/CrudFormElement';

/**
 * Shows a single contact method log entry
 */
export const ContactMethodLogBlock = ({
  contactMethodLog,
}: {
  contactMethodLog: ContactMethodLog;
}): ReactElement => {
  return (
    <CrudItemBlock
      title={`${makeActionTitle(contactMethodLog.action)} ${contactMethodLog.channel}`}
      controls={null}>
      <CrudFormElement title="Identifier">{contactMethodLog.identifier}</CrudFormElement>
      <CrudFormElement title="Reason">
        <pre>{JSON.stringify(contactMethodLog.reason, null, 2)}</pre>
      </CrudFormElement>
      <CrudFormElement title="Timestamp">
        {contactMethodLog.createdAt.toLocaleString()}
      </CrudFormElement>
    </CrudItemBlock>
  );
};

const makeActionTitle = (s: string): string => {
  const words = s.split('_');
  return (
    words[0][0].toUpperCase() + words[0].slice(1).toLowerCase() + ' ' + words.slice(1).join(' ')
  );
};
