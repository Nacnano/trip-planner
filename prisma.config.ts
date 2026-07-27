import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { getDatabaseUrl } from "./src/lib/database-url";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: getDatabaseUrl(),
  },
});
