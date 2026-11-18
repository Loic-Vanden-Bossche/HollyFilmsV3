import { spawn, execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import type {
  Alignment,
  SyncFailure,
  SyncStage,
} from '@hollyfilms/shared/subtitle-sync'

const execute = promisify(execFile)
const script = fileURLToPath(new URL('../worker/align.py', import.meta.url))
function python() {
  if (process.env.SUBTITLE_SYNC_PYTHON) return process.env.SUBTITLE_SYNC_PYTHON
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const local = join(
      process.env.LOCALAPPDATA,
      'hollyfilms-sync',
      'Scripts',
      'python.exe',
    )
    return existsSync(local) ? local : 'python'
  }
  return 'python3'
}
const ffmpeg = () => process.env.SUBTITLE_SYNC_FFMPEG || 'ffmpeg'
export const engineId = 'ffsubsync-0.5.1/webrtc2/affine-v2'

export class AnalysisFailure extends Error {
  readonly code: SyncFailure
  readonly diagnostic: {
    component: 'relay' | 'ffmpeg' | 'ffsubsync'
    status?: number
    exitCode?: number | null
    signal?: string | null
    reason?: string
  }

  constructor(code: SyncFailure, diagnostic: AnalysisFailure['diagnostic']) {
    super(code)
    this.code = code
    this.diagnostic = diagnostic
  }
}
export function limit(name: string, fallback: number, max: number) {
  const value = Number(process.env[name] || fallback)
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback
}
export const maxSeconds = () => limit('SUBTITLE_SYNC_MAX_SECONDS', 10800, 18000)
export const timeoutMs = () =>
  limit('SUBTITLE_SYNC_TIMEOUT_SECONDS', 900, 3600) * 1000
let probe: { until: number; value: Promise<boolean> } | undefined
export function engineAvailable() {
  if (process.env.SUBTITLE_SYNC_ENABLED === 'false')
    return Promise.resolve(false)
  if (!probe || Date.now() > probe.until) {
    const options = { timeout: 12000, windowsHide: true, maxBuffer: 65536 }
    probe = {
      until: Date.now() + 60000,
      value: Promise.all([
        execute(python(), [script, '--probe'], options),
        execute(ffmpeg(), ['-version'], options),
      ]).then(
        ([result]) => result.stdout.trim() === '0.5.1',
        () => false,
      ),
    }
  }
  return probe.value
}

// FFmpeg can seek (including MP4 with a trailing moov atom), but never receives
// a Jellyfin credential or a media-supplied URL. Only this job can use the relay.
export async function analyze(
  input: { url: string; token: string; subtitle: Buffer; audioOrdinal: number },
  signal: AbortSignal,
  stage: (value: SyncStage, processedSeconds?: number) => Promise<void>,
): Promise<Alignment | 'possible-cut' | null> {
  signal.throwIfAborted()
  const dir = await mkdtemp(join(tmpdir(), 'hollyfilms-sync-'))
  const secret = '/' + randomUUID()
  const controller = new AbortController()
  const stop = AbortSignal.any([signal, controller.signal])
  let sourceError: AnalysisFailure | undefined
  const relay = createServer(async (req, res) => {
    if (req.url !== secret || !['GET', 'HEAD'].includes(req.method || '')) {
      res.writeHead(404).end()
      return
    }
    const closed = new AbortController()
    res.on('close', () => closed.abort())
    try {
      const response = await fetch(input.url, {
        method: req.method,
        redirect: 'error',
        signal: AbortSignal.any([stop, closed.signal]),
        headers: {
          'X-Emby-Token': input.token,
          ...(req.headers.range ? { Range: req.headers.range } : {}),
        },
      })
      if (!response.ok) {
        sourceError = new AnalysisFailure('source', {
          component: 'relay',
          status: response.status,
        })
        await response.body?.cancel()
        res.writeHead(502).end()
        return
      }
      for (const key of [
        'content-length',
        'content-range',
        'accept-ranges',
        'content-type',
      ]) {
        const value = response.headers.get(key)
        if (value) res.setHeader(key, value)
      }
      res.statusCode = response.status
      if (response.body) await pipeline(Readable.from(response.body), res)
      else res.end()
    } catch {
      if (!closed.signal.aborted && !stop.aborted)
        sourceError = new AnalysisFailure('source', {
          component: 'relay',
          reason: 'transfer',
        })
      res.destroy()
    }
  })
  try {
    await writeFile(join(dir, 'source.srt'), input.subtitle, { mode: 0o600 })
    await new Promise<void>((resolve, reject) => {
      relay.once('error', reject)
      relay.listen(0, '127.0.0.1', resolve)
    })
    const address = relay.address()
    if (!address || typeof address === 'string') throw Error('relay')
    await stage('analyzing')
    stop.throwIfAborted()
    const options = {
      cwd: dir,
      signal: stop,
      windowsHide: true,
      env: {
        ...process.env,
        OPENBLAS_NUM_THREADS: '1',
        OMP_NUM_THREADS: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
    }
    const decoder = spawn(
      ffmpeg(),
      [
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'http,tcp',
        '-format_whitelist',
        'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mpeg,mpegts,asf,flv,ogg',
        '-threads',
        '1',
        '-copyts',
        '-start_at_zero',
        '-i',
        'http://127.0.0.1:' + address.port + secret,
        '-map',
        '0:a:' + input.audioOrdinal,
        '-vn',
        '-sn',
        '-dn',
        '-af',
        'aresample=16000:async=1:first_pts=0',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-f',
        's16le',
        'pipe:1',
      ],
      { ...options, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const worker = spawn(
      python(),
      [
        script,
        String(maxSeconds()),
        String(limit('SUBTITLE_SYNC_TEMP_MIB', 32, 128)),
      ],
      { ...options, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    let skippedInput = false
    let output = ''
    let progress = Promise.resolve()
    let result: Alignment | 'possible-cut' | null | undefined
    worker.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk
      const lines = output.split('\n')
      output = lines.pop() || ''
      for (const line of lines) {
        let data
        try {
          data = JSON.parse(line)
        } catch {
          continue
        }
        if (
          data.stage === 'aligning' ||
          data.stage === 'validating' ||
          (data.stage === 'analyzing' && Number.isInteger(data.seconds))
        )
          progress = progress
            .then(() => stage(data.stage, data.seconds))
            .catch(() => controller.abort())
        if (data.stage === 'skip-input') skippedInput = true
        if (data.stage === 'uncertain') result = null
        if (data.stage === 'possible-cut') result = 'possible-cut'
        if (
          data.stage === 'ready' &&
          Number.isFinite(data.scale) &&
          Math.abs(data.scale - 1) <= 0.061 &&
          Number.isInteger(data.shiftMs) &&
          Math.abs(data.shiftMs) <= 180000
        )
          result = { scale: data.scale, shiftMs: data.shiftMs }
      }
    })
    const finished = (
      child: typeof worker | typeof decoder,
      component: 'ffmpeg' | 'ffsubsync',
    ) =>
      new Promise<void>((resolve, reject) => {
        // stderr may contain cue text, paths or the relay URL. Only emit known categories.
        let tail = ''
        child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
          tail = (tail + chunk).slice(-4096)
        })
        child.once('error', (error: NodeJS.ErrnoException) =>
          reject(
            new AnalysisFailure('engine', {
              component,
              reason:
                error.code === 'ENOENT'
                  ? 'missing-executable'
                  : 'process-error',
            }),
          ),
        )
        child.once('close', (exitCode, signal) => {
          if (exitCode === 0) return resolve()
          const code =
            component === 'ffmpeg'
              ? /matches no streams/i.test(tail)
                ? 'audio'
                : 'decode'
              : /SRTParseError|UnicodeDecodeError/.test(tail)
                ? 'subtitle'
                : 'engine'
          reject(new AnalysisFailure(code, { component, exitCode, signal }))
        })
      })
    const decodeDone = finished(decoder, 'ffmpeg')
    const workerDone = finished(worker, 'ffsubsync')
    const transfer = pipeline(decoder.stdout, worker.stdin, { signal: stop })
    // Keep both exits: a broken pipe can otherwise mask the process that failed.
    // A worker that rejects sparse cues early also closes its PCM input early.
    void workerDone.then(
      () => {
        if (skippedInput) decoder.kill()
      },
      () => decoder.kill(),
    )
    const [decoded, worked, piped] = await Promise.allSettled([
      decodeDone,
      workerDone,
      transfer,
    ])
    await progress
    signal.throwIfAborted()
    if (sourceError) throw sourceError
    if (worked.status === 'rejected') throw worked.reason
    if (decoded.status === 'rejected' && !skippedInput) throw decoded.reason
    if (piped.status === 'rejected' && result !== null) throw piped.reason
    if (result === undefined)
      throw new AnalysisFailure('engine', {
        component: 'ffsubsync',
        reason: 'missing-result',
      })
    return result
  } finally {
    controller.abort()
    relay.closeAllConnections()
    relay.close()
    await rm(dir, { force: true, recursive: true })
  }
}
