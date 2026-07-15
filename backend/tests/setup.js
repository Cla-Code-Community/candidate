import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.test") });

process.env.SEARCH_KEY ??= "test-search-key";
process.env.ENCRYPTION_MASTER_KEY ??=
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.ENCRYPTION_KEY_ID ??= "test";
