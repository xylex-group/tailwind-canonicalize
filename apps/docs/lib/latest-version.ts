import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(
  here,
  "..",
  "..",
  "..",
  "packages",
  "cli",
  "package.json",
);

let cached: string | undefined;

export const getLatestVersion = async (): Promise<string> => {
  if (cached) {
    return cached;
  }

  try {
    const raw = await readFile(packageJsonPath, "utf-8");
    const { version } = JSON.parse(raw) as { version: string };
    cached = version;
    return version;
  } catch {
    return "0.1.0";
  }
};
