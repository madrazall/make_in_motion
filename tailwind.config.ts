import type { Config } from "tailwindcss";

/**
 * Neon-on-dark, from the CREATE flyer.
 *
 * Names are kept semantic rather than literal so the whole mood can be
 * retuned from this one file:
 *   paper   = the background you print on (here: near-black)
 *   ink     = what you write with (here: near-white)
 *   clay    = primary accent  -> hot pink neon
 *   sage    = secondary accent -> electric cyan neon
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./emails/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#08070f",       // page background — blue-black, like the brick in shadow
        surface: "#131120",     // cards
        surface2: "#1b1830",    // raised / hover
        ink: "#f4f1fa",         // primary text
        clay: "#ff2e88",        // hot pink neon
        "clay-dim": "#c41f68",
        sage: "#22e0ff",        // electric cyan neon
        "sage-dim": "#0ea5c9",
        violet: "#a855f7",
      },
      fontFamily: {
        display: ["Anton", "Impact", "sans-serif"],
        script: ["Yellowtail", "cursive"],
        sans: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "neon-pink":
          "0 0 12px rgba(255,46,136,.55), 0 0 40px rgba(255,46,136,.25)",
        "neon-cyan":
          "0 0 12px rgba(34,224,255,.55), 0 0 40px rgba(34,224,255,.25)",
        card: "0 10px 40px rgba(0,0,0,.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
