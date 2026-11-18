import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const name = 'hollyfilms-requests-test-' + randomUUID().slice(0, 8)
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', windowsHide: true }).trim()
try {
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=isolated-test-password',
    '-p',
    '127.0.0.1::5432',
    'postgres:17-alpine',
  )
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      docker('exec', name, 'pg_isready', '-U', 'postgres')
      ready = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready')
  const port = docker('port', name, '5432/tcp').split(':').at(-1)
  const databaseUrl = `postgresql://postgres:isolated-test-password@127.0.0.1:${port}/postgres`
  for (let attempt = 0; attempt < 2; attempt++)
    execFileSync(
      process.execPath,
      ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        stdio: 'inherit',
        windowsHide: true,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    )
  const status = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--test',
        ...(process.argv.slice(2).length
          ? process.argv.slice(2)
          : ['tests/requests.test.ts']),
      ],
      {
        stdio: 'inherit',
        windowsHide: true,
        env: {
          ...process.env,
          HOLLYFILMS_TEST_DATABASE_URL: databaseUrl,
        },
      },
    )
    child.once('error', reject)
    child.once('exit', resolve)
  })
  process.exitCode = status ?? 1
} finally {
  docker('rm', '-f', name)
}
