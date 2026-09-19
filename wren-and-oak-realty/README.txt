Wren & Oak Realty — website delivery
=====================================

WHAT'S IN HERE
- index.html — the CLIENT LOGIN page. This is now the entry point: open the
  site and you land here first, with the option to sign in or create an
  account.
- home.html — the main marketing website (hero, listings, agents,
  neighborhoods, contact) — everything that used to be index.html.
- signup.html — create a demo client account.
- account.html — the signed-in account page: saved homes and showings.
- auth.js — the small shared script powering the demo account system above.
  Accounts are stored only in this browser's local storage on this device —
  there's no server or real database behind it, so don't use a real
  password. Clearing your browser data (or opening the site on another
  device) resets it.
  All CSS lives in styles.css; images are embedded as data URIs inside the
  HTML files, so there's nothing else to link or copy.

HOW TO USE IT
- Open locally: just double-click index.html, or open it in any browser.
- Host it: upload index.html to any static host (Netlify, Vercel, GitHub Pages,
  S3, cPanel, etc.) — no build step, no server-side code, no dependencies.
- Edit it: it's plain HTML/CSS/JS. Colors and fonts are set as CSS variables
  near the top of the <style> block if you want to retheme it.

WHAT'S REAL VS. PLACEHOLDER
- Company name, agents, listings, addresses, phone and email are fictional —
  built for this demo. Replace them with your actual details before this
  goes live.
- The contact form and newsletter signup validate input and show a success
  message, but nothing is wired to a real inbox yet. Before launch you'll
  want to connect them to an email service, form backend (e.g. Formspree),
  or your CRM.
- Property photos are the stock images from the original template.
  Swap in real listing photos for production use.

NEXT STEPS (optional, ask if you want any of these)
- Wire the contact form to a real email/CRM backend
- Replace the demo account system (index/signup/account.html) with a real
  backend — a real database, hashed passwords, and session handling
  before this goes anywhere near production
- Add individual property detail pages
- Add a real map / neighborhood boundaries
- Swap in your real branding, name and photos
