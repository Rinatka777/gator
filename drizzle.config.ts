import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "src/lib/db/schema.ts",
  out: "src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgres://ekaterinasharifullina@localhost:5432/gator?sslmode=disable",
  },
});
