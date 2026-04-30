import * as MP4BoxLib from 'mp4box'
import type { ProcessorConfig } from '../types'

// mp4box 2.x exports the factory as a named export
const MP4Box = MP4BoxLib

interface MP4Sample {
  data: Uint8Array
  dts: number
  duration: number
  is_sync: boolean
}

interface MP4TrackInfo {
  id: number
  type: string
  video?: {
    width: number
    height: number
  }
  codec: string
  nb_samples: number
  timescale: number
}

/**
 * 使用 mp4box.js + WebCodecs VideoDecoder 解码视频帧。
 * 仅支持 MP4/H.264（H.265 支持取决于浏览器）。
 */
export const extractFramesFromVideoWebCodecs = async (
  config: ProcessorConfig,
): Promise<ImageData[]> => {
  const { file, frameRate, logger, progressManager } = config
  const log = logger.log

  progressManager.startNextStep()

  log(`开始处理视频文件（webcodecs 方案）: ${file.name}`)

  if (typeof VideoDecoder === 'undefined') {
    throw new Error('当前浏览器不支持 WebCodecs API，请切换为 video 或 ffmpeg 方案')
  }

  const arrayBuffer = await file.arrayBuffer()

  return new Promise<ImageData[]>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mp4box = (MP4Box as any).createFile()
    let decoder: VideoDecoder | null = null
    let videoTrackId = -1
    let totalSamples = 0
    let processedSamples = 0
    let videoWidth = 0
    let videoHeight = 0
    let trackTimescale = 1
    let rejected = false

    const safeReject = (e: unknown) => {
      if (rejected) return
      rejected = true
      try { decoder?.close() } catch { /* ignore */ }
      reject(e)
    }

    const decodedFrames: { timestamp: number; imageData: ImageData }[] = []

    mp4box.onError = (e: unknown) => safeReject(new Error(`mp4box 解析失败: ${e}`))

    mp4box.onReady = (info: { tracks: MP4TrackInfo[] }) => {
      try {
        const videoTrack = info.tracks.find(t => t.type === 'video')
        if (!videoTrack) {
          safeReject(new Error('视频文件中未找到视频轨道'))
          return
        }

        videoTrackId = videoTrack.id
        totalSamples = videoTrack.nb_samples
        videoWidth = videoTrack.video?.width ?? 0
        videoHeight = videoTrack.video?.height ?? 0
        trackTimescale = videoTrack.timescale

        log(`视频尺寸: ${videoWidth}x${videoHeight}, 总帧数: ${totalSamples}, codec: ${videoTrack.codec}`)

        const canvas = document.createElement('canvas')
        canvas.width = videoWidth
        canvas.height = videoHeight
        const ctx = canvas.getContext('2d')!

        decoder = new VideoDecoder({
          output: (frame: VideoFrame) => {
            ctx.drawImage(frame, 0, 0, videoWidth, videoHeight)
            decodedFrames.push({
              timestamp: frame.timestamp,
              imageData: ctx.getImageData(0, 0, videoWidth, videoHeight),
            })
            frame.close()
          },
          error: (e) => safeReject(new Error(`VideoDecoder 错误: ${e.message}`)),
        })

        const description = getCodecDescription(mp4box, videoTrackId)
        log(`codec: ${videoTrack.codec}, description: ${description ? `${description.byteLength} bytes` : 'none (Annex-B mode)'}`)

        decoder.configure({
          codec: videoTrack.codec,
          codedWidth: videoWidth,
          codedHeight: videoHeight,
          description,
        })

        mp4box.setExtractionOptions(videoTrackId, null, { nbSamples: 100 })
        mp4box.start()
      } catch (e) {
        safeReject(e)
      }
    }

    let seenKeyframe = false

    mp4box.onSamples = async (_trackId: number, _ref: unknown, samples: MP4Sample[]) => {
      if (rejected || !decoder) return
      try {
        for (const sample of samples) {
          // VideoDecoder requires the first chunk to be a keyframe after configure().
          // Skip leading non-keyframe samples in case mp4box delivers them first.
          if (!seenKeyframe && !sample.is_sync) continue
          seenKeyframe = true

          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: Math.round(sample.dts * 1_000_000 / trackTimescale),
            duration: Math.round(sample.duration * 1_000_000 / trackTimescale),
            data: sample.data,
          })
          decoder.decode(chunk)
          processedSamples++

          const progress = Math.floor((processedSamples / totalSamples) * 100)
          progressManager.updateStepProgress(progress)

          if (processedSamples % 50 === 0 || processedSamples === totalSamples) {
            log(`已解码 ${processedSamples}/${totalSamples} 帧`)
          }
        }

        if (processedSamples >= totalSamples) {
          await decoder!.flush()
          decoder!.close()

          decodedFrames.sort((a, b) => a.timestamp - b.timestamp)

          const videoDurationUs = decodedFrames.length > 0
            ? decodedFrames[decodedFrames.length - 1].timestamp
            : 0

          const frameIntervalUs = 1_000_000 / frameRate
          const result: ImageData[] = []
          let nextTarget = 0
          for (const f of decodedFrames) {
            if (f.timestamp >= nextTarget) {
              result.push(f.imageData)
              nextTarget += frameIntervalUs
            }
          }

          log(`帧提取完成，共 ${result.length} 帧（视频时长约 ${(videoDurationUs / 1_000_000).toFixed(2)}s）`)
          resolve(result)
        }
      } catch (e) {
        safeReject(e)
      }
    }

    const buf = arrayBuffer as ArrayBuffer & { fileStart: number }
    buf.fileStart = 0
    mp4box.appendBuffer(buf)
    mp4box.flush()
  })
}

// 提取编解码器描述符用于 VideoDecoder.configure()。
// H.264 使用 avcC box，H.265/HEVC 使用 hvcC box。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCodecDescription(mp4box: any, trackId: number): Uint8Array | undefined {
  try {
    // Prefer iterating moov.traks directly — getTrackById() behavior varies across mp4box versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trak = mp4box.moov?.traks?.find((t: any) => t.tkhd?.track_id === trackId)
      ?? mp4box.getTrackById?.(trackId)
    const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]
    // H.264: avcC box; H.265/HEVC: hvcC box
    const configBox = entry?.avcC ?? entry?.hvcC
    if (!configBox) return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = new (MP4BoxLib as any).DataStream(undefined, 0, (MP4BoxLib as any).DataStream.BIG_ENDIAN)
    configBox.write(stream)
    // write() prepends an 8-byte box header (4-byte size + 4-byte type name).
    // VideoDecoder.configure() description must be ONLY the decoder config record (no box header).
    // Use .slice() to get an independent copy from the pre-allocated DataStream buffer.
    return new Uint8Array(stream.buffer).slice(8, stream.pos)
  } catch (err) {
    console.warn('[webcodecs] getCodecDescription failed:', err)
    return undefined
  }
}

