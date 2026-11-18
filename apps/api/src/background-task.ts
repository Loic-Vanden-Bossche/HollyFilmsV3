import type { FastifyInstance } from 'fastify'

// Bound per-process concurrency and finish in-flight work before Prisma disconnects.
export function backgroundTask(
  app: FastifyInstance,
  intervalMs: number,
  run: () => Promise<void>,
  failureMessage: string,
) {
  let running: Promise<void> | undefined
  let timer: NodeJS.Timeout
  function poll() {
    if (!running)
      running = run()
        .catch(() => app.log.warn(failureMessage))
        .finally(() => {
          running = undefined
        })
  }
  app.addHook('onReady', async () => {
    poll()
    timer = setInterval(poll, intervalMs)
    timer.unref()
  })
  app.addHook('onClose', async () => {
    clearInterval(timer)
    await running
  })
}
