import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from '../../utils/ffmpegInstance'
import type { ProcessorConfig } from '../types'

/**
 * 使用 ffmpeg.wasm 解码视频帧。
 * 兼容性最强，支持所有常见视频格式，但首次需加载约 10MB 的 WASM 文件。
 */
export const extractFramesFromVideoFFmpeg = async (
  config: ProcessorConfig,
): Promise<ImageData[]> => {
  const { file, frameRate, logger, progressManager } = config
  const log = logger.log

  progressManager.startNextStep()

  log(`开始处理视频文件（ffmpeg 方案）: ${file.name}`)

  const ffmpeg = await getFFmpeg(log)

  const ext = file.name.split('.').pop() || 'mp4'
  const inputName = `input.${ext}`

  log('写入视频文件到 WASM 虚拟文件系统…')
  await ffmpeg.writeFile(inputName, await fetchFile(file))

  log(`提取帧，帧率: ${frameRate} fps…`)

  // 使用 ffmpeg progress 事件驱动进度（0..1）
  const onProgress = ({ progress }: { progress: number }) => {
    progressManager.updateStepProgress(Math.min(99, Math.floor(progress * 100)))
  }
  ffmpeg.on('progress', onProgress)

  try {
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', `fps=${frameRate}`,
      '-f', 'image2',
      'frame_%04d.png',
    ])
  } catch (error) {
    log(`ffmpeg 解码失败: ${error instanceof Error ? error.message : '未知错误'}`)
    throw error
  } finally {
    ffmpeg.off('progress', onProgress)
  }

  log('开始读取帧…')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const extractedFrames: ImageData[] = []
  let i = 1

  while (true) {
    const frameName = `frame_${String(i).padStart(4, '0')}.png`
    let data: Uint8Array
    try {
      data = (await ffmpeg.readFile(frameName)) as Uint8Array
    } catch {
      break
    }

    // .slice() copies to a plain ArrayBuffer-backed Uint8Array (avoids SharedArrayBuffer typing issues)
    const bytes = data instanceof Uint8Array ? data.slice() : new TextEncoder().encode(String(data))
    const blob = new Blob([bytes], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)

    if (i === 1) {
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      log(`帧尺寸: ${bitmap.width}x${bitmap.height}`)
    }

    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    extractedFrames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))

    await ffmpeg.deleteFile(frameName)
    i++

    if (i % 10 === 1) {
      log(`已读取 ${extractedFrames.length} 帧`)
    }
  }

  await ffmpeg.deleteFile(inputName)

  progressManager.updateStepProgress(100)
  log(`帧提取完成，共 ${extractedFrames.length} 帧`)
  return extractedFrames
}
