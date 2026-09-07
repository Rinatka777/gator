# Gator

A CLI tool that lets users:

- Add RSS feeds from across the internet to be collected
- Store the collected posts in a PostgreSQL database
- Follow and unfollow RSS feeds that other users have added
- View summaries of the aggregated posts in the terminal, with a link to the full post

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a database:

   ```bash
   createdb gator
   ```

3. Create a config file at `~/.gatorconfig.json`:

   ```json
   {
     "db_url": "postgres://<user>@localhost:5432/gator?sslmode=disable"
   }
   ```

   Gator reads this file on every run and writes back to it (adding
   `current_user_name`) when you log in or register.

4. Run the database migrations:

   ```bash
   npm run migrate
   ```

   (`npm run generate` regenerates migration files after a schema change in
   `src/lib/db/schema.ts`; `drizzle.config.ts` is the source of truth for
   which database migrations apply to.)

5. Run a command:

   ```bash
   npm start -- register alice
   ```

## Commands

| Command | Description |
| --- | --- |
| `register <name>` | Create a new user and log in as them |
| `login <name>` | Switch the current user |
| `users` | List all users, marking the current one |
| `reset` | Delete all users (and, via cascade, their feeds/follows/posts) |
| `addfeed <name> <url>` | Add a feed and automatically follow it (requires login) |
| `feeds` | List every feed that's been added, with its creator |
| `follow <url>` | Follow an existing feed by URL (requires login) |
| `unfollow <url>` | Unfollow a feed by URL (requires login) |
| `following` | List the feeds the current user follows (requires login) |
| `browse [limit]` | Show posts from the current user's followed feeds, newest first (default limit: 2, requires login) |
| `agg <duration>` | Continuously fetch the least-recently-updated feed on an interval (e.g. `1m`, `30s`, `1h`); run this in its own terminal, stop with Ctrl+C |

A typical first run:

```bash
npm start -- register alice
npm start -- addfeed "Boot.dev Blog" https://blog.boot.dev/index.xml
npm start -- agg 1m       # leave running in one terminal
npm start -- browse       # in another terminal, once posts have been collected
```

## Testing

```bash
npm test
```

This runs the mocked unit tests (`src/commands.test.ts`, `src/config.test.ts`) —
fast, no database required.

The query-layer tests under `src/lib/db/queries/*.test.ts` are integration
tests that hit a real Postgres database and are skipped by default. To run
them:

1. Create a dedicated test database and apply the migrations to it:

   ```bash
   createdb gator_test
   ```

2. Create `test-config.json` in the repo root (already gitignored — never
   commit real credentials here):

   ```json
   { "db_url": "postgres://<user>@localhost:5432/gator_test?sslmode=disable" }
   ```

3. Run the suite against it:

   ```bash
   GATORCONFIG=./test-config.json GATOR_INTEGRATION=1 npm test
   ```

Without `GATOR_INTEGRATION=1` the whole integration suite is skipped, so
plain `npm test` stays fast and never touches a database.
