<h1 align="center">huddle!</h1>

<p align="center">
  A real-time multiplayer platform hosting a collection of party games.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=vite&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=flat-square" />
  <img src="https://img.shields.io/badge/Socket.io-black?style=flat-square&logo=socket.io&badgeColor=010101" />
</p>

## Games

**Pack 1** · *in progress*

- 🤥 **Believable Lies** — bluffing trivia game
- 🔓 **Breachpoint** — social deduction with a hacker theme
- 🐓 **Super Sabong** — betting tournament with strategy
- 🎨 **Squadoodle** — drawing telephone game
- 👀 **Impostors** — task-based voting game
- 😂 **Witzone** — comedy prompt game

**Pack 2** · *in progress*

- 🃏 **Poker Night** — classic texas hold'em

## Project Structure

This is a monorepo:

```
huddle/
├── client/   # React + Vite frontend
├── server/   # Express + Socket.io game server
└── shared/   # Types and schemas shared between client and server
```

## Setup

Requires **[Node.js 22+](https://nodejs.org/en/download)**

**1. Clone**

```bash
git clone https://github.com/nathanielseth/huddle.git
cd huddle
```

> Or [download as ZIP](https://github.com/nathanielseth/huddle/archive/refs/heads/main.zip) instead.

**2. Install**

```bash
npm install
```
This will install all depencies in the workspace.

**3. Run**

```bash
npm run dev
```

Once running, share the **Network** URL from the console with anyone on the same network.

## License

[MIT](./LICENSE)