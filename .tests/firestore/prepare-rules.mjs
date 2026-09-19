import { copyFile } from "node:fs/promises";

// Generated for each run. The root production file is the only rules source.
await copyFile(
  new URL("../../firestore.rules", import.meta.url),
  new URL("./firestore.generated.rules", import.meta.url)
);
console.log("Refreshed local emulator rules from root firestore.rules.");
