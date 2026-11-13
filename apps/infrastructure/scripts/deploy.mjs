import { spawnSync } from 'node:child_process'
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs'
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
const owner = 'Loic-Vanden-Bossche'
const repo = 'HollyFilmsV3'
const githubRepository = `${owner}/${repo}`
const sourceUrl =
  process.env.GHCR_SOURCE_URL || `https://github.com/${githubRepository}`
const environment = { ...process.env }
const capture = ['ignore', 'pipe', 'inherit']
function run(command, args, cwd = root, stdio = 'inherit') {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    stdio,
    encoding: 'utf8',
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `${command} ${args[0]} a échoué (${result.status}). Déploiement arrêté.`,
    )
  return result.stdout?.trim()
}

const revision = run('git', ['rev-parse', 'HEAD'], root, capture)
const releaseQuery = `query($owner: String!, $repo: String!, $revision: String!, $tag: String!, $version: String!) {
  repository(owner: $owner, name: $repo) {
    commit: object(expression: $revision) { oid }
    tag: object(expression: $tag) { oid }
    release(tagName: $version) { url }
  }
}`
const github = JSON.parse(
  run(
    'gh',
    [
      'api',
      'graphql',
      '--hostname',
      'github.com',
      '-f',
      `query=${releaseQuery}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `repo=${repo}`,
      '-f',
      `revision=${revision}`,
      '-f',
      `tag=refs/tags/${version}^{commit}`,
      '-f',
      `version=${version}`,
      '--jq',
      '.data.repository',
    ],
    root,
    capture,
  ),
)
if (github?.commit?.oid !== revision)
  throw new Error(
    `Pousse le commit ${revision} sur ${githubRepository} avant de le publier.`,
  )
if (github.release)
  throw new Error(
    `La release ${version} existe déjà (${github.release.url}). Utilise une nouvelle version.`,
  )
if (github.tag && github.tag.oid !== revision)
  throw new Error(
    `Le tag ${version} pointe vers un autre commit sur ${githubRepository}.`,
  )

// Validate configuration before publishing any image; never apply on build failure.
run('terraform', ['fmt', '-check', '-recursive'], infrastructure)
run('terraform', ['init', '-input=false'], infrastructure)
run('terraform', ['validate'], infrastructure)

const artifacts = resolve(infrastructure, '.artifacts')
mkdirSync(artifacts, { recursive: true })
const buildDirectory = mkdtempSync(resolve(artifacts, 'build-'))
try {
  console.log(`Construction des images depuis le commit ${revision}.`)
  const source = resolve(buildDirectory, 'source.tar')
  run('git', ['archive', '--format=tar', `--output=${source}`, revision])
  for (const target of ['api', 'web']) {
    const tag = `${repository}-${target}:${version}`
    const metadata = resolve(buildDirectory, `${target}-image.json`)
    const input = openSync(source, 'r')
    try {
      run(
        'docker',
        [
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
          '--build-arg',
          `SOURCE_URL=${sourceUrl}`,
          '--label',
          `org.opencontainers.image.revision=${revision}`,
          '--label',
          `org.opencontainers.image.version=${version}`,
          '-',
        ],
        root,
        [input, 'inherit', 'inherit'],
      )
    } finally {
      closeSync(input)
    }
    const digest = JSON.parse(readFileSync(metadata, 'utf8'))[
      'containerimage.digest'
    ]
    if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? ''))
      throw new Error(`Digest de ${target} absent ; aucun déploiement.`)
    environment[`TF_VAR_${target}_image`] = `${repository}-${target}@${digest}`
  }
} finally {
  rmSync(buildDirectory, { recursive: true, force: true })
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
run('gh', [
  'release',
  'create',
  version,
  '--repo',
  `github.com/${githubRepository}`,
  ...(github.tag ? ['--verify-tag'] : ['--target', revision]),
  '--title',
  version,
  '--generate-notes',
  '--notes',
  `Images GHCR\n\n- API \`${environment.TF_VAR_api_image}\`\n- Web \`${environment.TF_VAR_web_image}\`\n`,
])
if (options.includes('--apply')) {
  run(
    'terraform',
    ['apply', '-input=false', '-lock-timeout=5m', plan],
    infrastructure,
  )
  run('terraform', ['output', 'url'], infrastructure)
} else {
  console.log(
    '\nImages et release publiées. Pour appliquer le plan préparé :\nterraform -chdir=apps/infrastructure apply hollyfilms.tfplan',
  )
}
