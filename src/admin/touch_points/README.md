NOTES for implementation

need to redo bigtouchpoint, messages

1. explicit save (don't bother with save on change, it's going to be too messy with dragover)
2. fix priorities to be ascending starting from 1 after every change
3. make sure the draggable table thing is its own component
4. creating a touch point will initialize it to 1 test sms, 1 test push, and 1 test email,
   then redirect, rather than trying to make the touch point messages section work for
   that case
