import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  {
    label: "iOS Firebase config",
    source: process.env.GOOGLE_SERVICE_INFO_PLIST
      || path.join(appRoot, "GoogleService-Info.plist"),
    destinations: [
      path.join(appRoot, "ios", "GoogleService-Info.plist"),
      path.join(appRoot, "ios", "Tour", "GoogleService-Info.plist"),
    ],
  },
  {
    label: "Android Firebase config",
    source: process.env.GOOGLE_SERVICES_JSON
      || path.join(appRoot, "google-services.json"),
    destinations: [path.join(appRoot, "android", "app", "google-services.json")],
  },
];

for (const file of files) {
  try {
    await stat(file.source);
  } catch {
    throw new Error(
      `${file.label} was not found at ${file.source}. Add the local file or configure its EAS file variable.`,
    );
  }

  for (const destination of file.destinations) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(file.source, destination);
  }
  console.log(`${file.label} is ready for the native build.`);
}
