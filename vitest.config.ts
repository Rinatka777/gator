import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration test files share one real Postgres database and clean up
    // by deleting all rows in afterEach; running files in parallel lets one
    // file's cleanup wipe data another file's test is still using.
    fileParallelism: false,
  },
});
