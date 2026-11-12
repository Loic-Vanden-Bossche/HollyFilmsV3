import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'

const envFile = new URL('../../.env', import.meta.url)
if (existsSync(envFile)) loadEnvFile(fileURLToPath(envFile))

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
})
