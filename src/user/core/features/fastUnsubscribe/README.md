This feature is shown if the user clicks on an unsubscribe link within an email;
it should immediately unsubscribe from email notifications and ideally show them
their notification settings so they can configure it

we allow them to unsubscribe without having to login by creating an endpoint
that accepts a link code to the unsubscribe page plus an email address. the
email they put in does not need to match the link code, but the relationship is
stored and can be used to detect abuse
