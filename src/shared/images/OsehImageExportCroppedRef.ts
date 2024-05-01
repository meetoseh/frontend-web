import { OsehImageExport } from './OsehImageExport';
import { DisplaySize } from './OsehImageProps';

export type OsehImageExportCroppedRef = {
  /** The export which is to be cropped */
  export: OsehImageExport;
  /** The logical display size we want to crop the image to, might be underspecified */
  cropTo: DisplaySize;
};
