# Personal Dashboard

A set of small, self-contained HTML apps that share a top bar.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

One click → Vercel signs you in, copies the repo to your GitHub, and deploys it. ~30 seconds to a live URL.

## How to use

Open any `.html` file directly in your browser — no build step, no install.

| File | What it is |
|---|---|
| [index.html](index.html) | Home hub — bento grid of links to every page |
| [main.html](main.html) | Goals tracker (Day Ring, Goal Ticker, To Do list) |
| [template.html](template.html) | Starter template for building new pages or sections in the same design |
| [theme.css](theme.css) | Shared "quiet luxury" theme — fonts, colours and background for every page |
| [lock.js](lock.js) | Passcode lock screen on every page — auto-locks after 30 min idle, Ctrl/Cmd + Shift + L to lock. Forgot it? Run `localStorage.removeItem("alps:lock:hash")` in the browser console and reload. |
| [health.html](health.html) | Supplement / daily stack tracker |
| [po-water.html](po-water.html) | Water intake tracker |
| [sleep.html](sleep.html) | Sleep log — bedtime, wake time, 7-night average and streak |
| [finance.html](finance.html) | Finances |
| [gym.html](gym.html) | Progressive overload gym tracker |
| [topbar.js](topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |

Each app stores its own state in browser `localStorage`. No accounts, no server.

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate `main.html` — paste it into Claude if you want to rebuild that page yourself.
