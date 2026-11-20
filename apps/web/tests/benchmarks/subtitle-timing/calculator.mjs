// Only used by the benchmark. The app does not ship this module.
export async function openCalculator(input) {
  const request = performance.now()
  const response = await fetch('/intervals.wasm')
  if (!response.ok) throw new Error('Wasm benchmark asset unavailable')
  const bytes = await response.arrayBuffer()
  const downloaded = performance.now()
  const { instance } = await WebAssembly.instantiate(bytes)
  const compiled = performance.now()
  const { memory, intervals, __heap_base } = instance.exports
  const pointer = Number(__heap_base.value)
  const required = pointer + 2 * input.byteLength
  if (required > memory.buffer.byteLength)
    memory.grow(Math.ceil((required - memory.buffer.byteLength) / 65536))
  new Float64Array(memory.buffer, pointer, input.length).set(input)
  const output = new Float64Array(
    memory.buffer,
    pointer + input.byteLength,
    input.length,
  )
  return {
    downloadMs: downloaded - request,
    compileMs: compiled - downloaded,
    calculate({ scale, shift, manual, origin, duration }) {
      intervals(
        pointer,
        input.length / 2,
        scale,
        shift,
        manual,
        origin,
        duration,
      )
      return output
    },
  }
}

if (
  typeof WorkerGlobalScope !== 'undefined' &&
  self instanceof WorkerGlobalScope
) {
  let calculator
  self.onmessage = async ({ data: { input, params } }) => {
    try {
      const cold = !calculator
      calculator ??= await openCalculator(input)
      const times = calculator.calculate(params).slice()
      self.postMessage(
        {
          times,
          downloadMs: cold ? calculator.downloadMs : 0,
          compileMs: cold ? calculator.compileMs : 0,
        },
        [times.buffer],
      )
    } catch (error) {
      self.postMessage({ error: String(error) })
    }
  }
}
