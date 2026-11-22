import "server-only";
import { version } from "../../package.json";

/** The app's version (package.json), added to bug reports on the server. */
export const APP_VERSION: string = version;
