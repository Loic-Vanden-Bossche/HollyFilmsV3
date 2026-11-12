import { createApp } from './app.ts'
import { readConfig } from './config.ts'

const app = await createApp(readConfig(process.env))
await app.listen({
  host: process.env.HOLLYFILMS_API_HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close())
}
