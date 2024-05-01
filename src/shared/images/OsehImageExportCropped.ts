import { OsehImageExport } from './OsehImageExport';
import { DisplaySize } from './OsehImageProps';

export type OsehImageExportCropped = {
  /** The export that was cropped */
  export: OsehImageExport;
  /** The logical display size we wanted to crop the image to, might be underspecified */
  cropTo: DisplaySize;
  /** The physical width and height that we cropped the image to */
  croppedTo: { width: number; height: number };
  /** The logical width and height we expect the image to be rendered at */
  croppedToDisplay: { displayWidth: number; displayHeight: number };
  /** The URL constructed via createObjectURL pointing to the cropped contents of the playlist item */
  croppedUrl: string;
};
