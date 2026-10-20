# Gather — Real-time messaging with AI

A Slack-inspired team chat with real-time messages, presence, typing indicators, searchable channels, message reactions, and optional AI recaps and reply drafting.

## Requirements

- Node.js 20.19 or later
- MongoDB locally or a MongoDB connection string
- A Gemini API key to turn on AI features (optional)

## Start the application

In one terminal, configure and start the API:

```powershell
cd server
Copy-Item .env.example .env
npm install
npm run dev
```

The server uses the `dotenv` npm package and [central configuration module](./server/src/config/config.js) to load and validate settings from `server/.env` at startup. Copy `server/.env.example` to `server/.env`, then set `MONGO_URI` and a unique `JWT_SECRET` of at least 32 characters. The server seeds the `The Good Place` workspace and starter channels on startup. To create its first workspace owner, set `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 8 characters and no more than 72 UTF-8 bytes, matching the registration password policy; the owner can manage member roles. If you do not want to seed an owner, leave **both** admin variables blank. All new registrations are regular members.

To activate AI conversation summaries and message suggestions, set `GEMINI_API_KEY`. AI requests use the last 40 messages in the selected channel, are limited to eight requests per member per minute, and only send the API key from the server. Without a key, messaging works normally and AI returns a clear setup message.

In a second terminal, start the React app:

```powershell
cd client
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). Configure `CLIENT_ORIGIN` in `server/.env` if the client is served from a different origin. The server `.env` values are loaded by `dotenv`; `VITE_API_URL` and `VITE_SOCKET_URL` in the client `.env` configure the API and Socket.IO server URLs.

## Features

- Account registration, bcrypt password hashing, signed and expiring JWTs.
- Workspace membership and workspace-scoped channels.
- Owner-only member and role management, with safeguards for the workspace owner and last administrator.
- Bidirectional Socket.IO messaging with JWT handshake authentication, persisted messages, typing indicators, online presence, and per-socket message rate limits.
- Cursor-based message history, channel search, reactions, and author-only message edits and deletes.
- Optional Gemini-generated channel summaries and contextual reply suggestions, with no client-side API key.
- Reusable React message, composer, authentication, and AI assistant components.
- Responsive workspace interface and clear handling of disconnected sockets and API failures.

## API overview

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Create a workspace member account |
| `POST` | `/api/auth/login` | Public | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Signed in | Get account, workspace, and members |
| `GET`, `POST` | `/api/channels` | Signed in | Browse or create workspace channels |
| `GET` | `/api/admin/members` | Workspace admin | List workspace members |
| `PATCH` | `/api/admin/members/:memberId/role` | Workspace admin | Change a member's role |
| `GET` | `/api/channels/:channelId/messages` | Signed in | Load a channel's paginated history |
| `GET` | `/api/messages/search?q=...` | Signed in | Search messages in the workspace |
| `PATCH`, `DELETE` | `/api/messages/:messageId` | Author | Edit or delete your message |
| `PUT` | `/api/messages/:messageId/reactions` | Signed in | Toggle a reaction |
| `POST` | `/api/channels/:channelId/ai/summary` | Signed in | Summarize recent channel discussion |
| `POST` | `/api/channels/:channelId/ai/suggestion` | Signed in | Draft a contextual reply |
| `GET` | `/api/health` | Public | Check API availability |

### Socket.IO events

Authenticate using `io(url, { auth: { token } })`. Join a workspace channel with `channel:join` before sending or typing. Send a message with `message:send` and `{ channelId, content }`; the server persists it and broadcasts `message:new`. The server also emits `message:update`, `message:delete`, `typing:update`, and `presence:update`, and sends the current `presence:list` on connect.
