import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const infrastructure = fileURLToPath(new URL('..', import.meta.url))
const root = resolve(infrastructure, '../..')
const [version, ...options] = process.argv.slice(2)
if (
  !version ||
  !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(version) ||
  version === 'latest' ||
  options.some((o) => o !== '--apply')
) {
  console.error('Usage : corepack yarn deploy <version> [--apply]')
  process.exit(1)
}
const repository =
  process.env.GHCR_IMAGE || 'ghcr.io/loic-vanden-bossche/hollyfilms-v3'
if (!/^ghcr\.io\/[a-z0-9_.-]+\/[a-z0-9_./-]+$/.test(repository))
  throw new Error('GHCR_IMAGE doit être un dépôt GHCR en minuscules, sans tag.')
const artifacts = resolve(infrastructure, '.artifacts')
mkdirSync(artifacts, { recursive: true })
const environment = { ...process.env }
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `${command} a échoué (${result.status}). Déploiement arrêté.`,
    )
}

// Validate configuration before publishing any image; never apply on build failure.
run('terraform', ['fmt', '-check', '-recursive'], infrastructure)
run('terraform', ['init', '-input=false'], infrastructure)
run('terraform', ['validate'], infrastructure)
for (const target of ['api', 'web']) {
  const tag = `${repository}-${target}:${version}`
  const metadata = resolve(artifacts, `${target}-image.json`)
  run('docker', [
    'buildx',
    'build',
    '--platform',
    process.env.DOCKER_PLATFORM || 'linux/amd64',
    '--target',
    target,
    '-f',
    'apps/infrastructure/docker/Dockerfile',
    '--tag',
    tag,
    '--push',
    '--metadata-file',
    metadata,
    ...(process.env.GHCR_SOURCE_URL
      ? ['--build-arg', `SOURCE_URL=${process.env.GHCR_SOURCE_URL}`]
      : []),
    '.',
  ])
  const digest = JSON.parse(readFileSync(metadata, 'utf8'))[
    'containerimage.digest'
  ]
  if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? ''))
    throw new Error(`Digest de ${target} absent ; aucun déploiement.`)
  environment[`TF_VAR_${target}_image`] = `${repository}-${target}@${digest}`
}
const plan = resolve(infrastructure, 'hollyfilms.tfplan')
// Explicit CLI image variables override any older image in terraform.tfvars.
run(
  'terraform',
  [
    'plan',
    '-input=false',
    '-lock-timeout=5m',
    `-var=api_image=${environment.TF_VAR_api_image}`,
    `-var=web_image=${environment.TF_VAR_web_image}`,
    `-out=${plan}`,
  ],
  infrastructure,
)
if (options.includes('--apply')) {
  run(
    'terraform',
    ['apply', '-input=false', '-lock-timeout=5m', plan],
    infrastructure,
  )
  run('terraform', ['output', 'url'], infrastructure)
} else {
  console.log(
    '\nImages publiées et plan préparé. Pour appliquer ce plan :\nterraform -chdir=apps/infrastructure apply hollyfilms.tfplan',
  )
}
