import type { ProcessorConfig } from '../types'
import { extractFramesFromVideoVideo } from './video'
import { extractFramesFromVideoWebCodecs } from './webcodecs'
import { extractFramesFromVideoFFmpeg } from './ffmpeg'

export const extractFramesFromVideo = async (
  config: ProcessorConfig,
): Promise<ImageData[]> => {
  switch (config.decoderMethod) {
    case 'video':
      return extractFramesFromVideoVideo(config)
    case 'webcodecs':
      return extractFramesFromVideoWebCodecs(config)
    case 'ffmpeg':
      return extractFramesFromVideoFFmpeg(config)
  }
}
