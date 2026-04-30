import { FFmpeg } from '@ffmpeg/ffmpeg'
import type { LogEvent } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

let instance: FFmpeg | null = null
let loadingPromise: Promise<FFmpeg> | null = null

export const getFFmpeg = async (log: (msg: string) => void): Promise<FFmpeg> => {
  if (instance && instance.loaded) {
    return instance
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg()
    ffmpeg.on('log', ({ message }: LogEvent) => {
      log(`[ffmpeg] ${message}`)
    })

    log('正在加载 ffmpeg.wasm（约 10MB，首次加载较慢）…')
    await ffmpeg.load({ coreURL, wasmURL })
    log('ffmpeg.wasm 加载完成')

    instance = ffmpeg
    return ffmpeg
  })()

  try {
    return await loadingPromise
  } finally {
    loadingPromise = null
  }
}
