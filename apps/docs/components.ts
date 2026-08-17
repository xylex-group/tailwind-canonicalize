import { defineComponents } from "blume";
import Context7Script from "./components/Context7Script.astro";

/**
 * Site chrome overrides. Footer injects the Context7 widget on every docs page
 * (RootLayout). The marketing homepage loads the same component via PageLayout's
 * `footer` slot in `pages/index.astro`.
 */
export default defineComponents({
  layout: {
    Footer: Context7Script,
  },
});
