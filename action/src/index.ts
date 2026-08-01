/**
 * Thin programmatic entry used by composite action consumers who embed the package.
 */
import { run } from "tailwind-canonicalize";

const code = await run(process.argv.slice(2));
process.exit(code);
