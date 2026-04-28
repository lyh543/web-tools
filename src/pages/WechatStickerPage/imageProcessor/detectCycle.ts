import type { CycleBoundary, DetectCycleOptions, ImageProcessor } from './types';

/**
 * 基于 ImageData 数组的循环边界检测（轻量版，无依赖）
 * @param {Array<ImageData>} imageDataList - 已抽好的帧数据数组（每一项是 ImageData 对象）
 * @param {Object} options - 配置项（默认适配多数场景）
 * @returns {Array} 循环边界数组，含循环起点/终点（帧索引+时间）、循环时长
 */
function detectCycle(
  imageDataList: ImageData[],
  options: DetectCycleOptions
): CycleBoundary[] {
  // 默认配置（可根据帧质量、循环规律微调）
  const config = {
    hashDiffThreshold: 2,    // 哈希差异阈值（≤2视为高度相似）
    consecutiveMatch: 3,     // 连续匹配帧数（≥3帧相似才认定循环）
    minCycleTime: 500,       // 最小循环时长（ms，避免短帧抖动误判）
    ...options,
  };

  const { hashDiffThreshold, consecutiveMatch, minCycleTime, logger, frameRate } = config;
  const frameCount = imageDataList.length;
  const frameHashes: string[] = [];    // 存储每帧的dHash（轻量特征）
  const frameTimes: number[] = [];     // 存储每帧的时间戳（ms）
  const cycleBoundaries: CycleBoundary[] = [];// 最终循环边界结果

  logger.log(`开始检测循环边界，总帧数: ${frameCount}, 帧率: ${frameRate}fps`);
  logger.debug(`配置参数 - hashDiffThreshold: ${hashDiffThreshold}, consecutiveMatch: ${consecutiveMatch}, minCycleTime: ${minCycleTime}ms`);

  // 1. 预处理：计算所有帧的dHash和时间戳（核心轻量计算）
  logger.debug('开始计算帧哈希...');
  for (let i = 0; i < frameCount; i++) {
    const imageData = imageDataList[i];
    // 计算当前帧的dHash（10ms内完成单帧，比像素对比快10倍+）
    const hash = calculateDHashFromImageData(imageData);
    frameHashes.push(hash);
    // 计算当前帧的时间戳（基于帧率）
    frameTimes.push((i / frameRate) * 1000);
  }
  logger.debug(`帧哈希计算完成，共 ${frameHashes.length} 帧`);

  // 2. 计算dHash（差异哈希，适配ImageData，无Canvas依赖）
  function calculateDHashFromImageData(imageData: ImageData): string {
    const thumbWidth = 9;  // dHash标准尺寸：9x8（生成64位哈希）
    const thumbHeight = 8;
    const { data: pixels, width: imgWidth } = imageData;

    let hash = '';
    // 遍历缩略图的每个像素（无需绘制Canvas，直接计算灰度差异）
    for (let y = 0; y < thumbHeight; y++) {
      // 按比例取原图行（适配任意分辨率帧）
      const originalY = Math.floor((y / thumbHeight) * imageData.height);
      const rowStart = originalY * imgWidth * 4; // RGBA格式，每像素4个值

      for (let x = 0; x < thumbWidth - 1; x++) {
        // 按比例取原图列
        const originalX1 = Math.floor((x / thumbWidth) * imgWidth);
        const originalX2 = Math.floor(((x + 1) / thumbWidth) * imgWidth);

        // 计算两个像素的灰度值（RGB平均值）
        const gray1 = (pixels[rowStart + originalX1 * 4] + pixels[rowStart + originalX1 * 4 + 1] + pixels[rowStart + originalX1 * 4 + 2]) / 3;
        const gray2 = (pixels[rowStart + originalX2 * 4] + pixels[rowStart + originalX2 * 4 + 1] + pixels[rowStart + originalX2 * 4 + 2]) / 3;

        // 对比灰度，生成哈希位（1=当前<右侧，0=相反）
        hash += gray1 < gray2 ? '1' : '0';
      }
    }
    return hash;
  }

  // 3. 对比哈希，筛选循环边界（核心匹配逻辑）
  function findCycleBoundaries(): void {
    logger.debug('开始查找循环边界...');
    // 遍历每帧，作为潜在循环起点
    for (let i = 0; i < frameCount - consecutiveMatch; i++) {
      // 跳过已认定为循环区间内的帧（避免重复检测）
      if (cycleBoundaries.some(b => i >= b.startFrame && i <= b.endFrame)) continue;

      // 潜在匹配起点：至少间隔“最小循环时长对应的帧数”（避免短重复误判）
      const minMatchOffset = Math.max(consecutiveMatch, Math.ceil((minCycleTime / 1000) * frameRate));
      // 遍历后续可能的匹配终点起点
      for (let j = i + minMatchOffset; j < frameCount - consecutiveMatch; j++) {
        let matchCount = 0;

        // 检查连续N帧是否都满足相似度要求
        for (let k = 0; k < consecutiveMatch; k++) {
          const diff = calculateHashDiff(frameHashes[i + k], frameHashes[j + k]);
          if (diff <= hashDiffThreshold) {
            matchCount++;
          } else {
            break; // 连续匹配中断，退出循环
          }
        }

        // 满足“连续N帧相似”，认定为有效循环边界
        if (matchCount >= consecutiveMatch) {
          const startFrame = i;
          const endFrame = j - 1; // 循环终点 = 下一轮起点 - 1
          const cycleTime = frameTimes[j] - frameTimes[i]; // 循环时长（ms）

          logger.debug(`候选循环边界: 帧${startFrame}-${endFrame}, 时长${cycleTime.toFixed(0)}ms`);

          // 二次验证：循环区间内无明显跳变（排除偶然相似）
          if (verifyCycleValidity(startFrame, j, cycleTime)) {
            logger.log(`✓ 检测到有效循环: 帧${startFrame}-${endFrame} (${(frameTimes[i]/1000).toFixed(2)}s-${(frameTimes[endFrame]/1000).toFixed(2)}s), 循环时长${(cycleTime/1000).toFixed(2)}s`);
            cycleBoundaries.push({
              startFrame,          // 循环起点（帧索引）
              endFrame,            // 循环终点（帧索引）
              startMs: frameTimes[i],       // 循环起点时间（ms）
              endMs: frameTimes[endFrame],  // 循环终点时间（ms）
              cycleTime,           // 循环时长（ms）
              cycleFrameCount: j - i,       // 循环包含的帧数
            });

            // 跳过当前循环区间，避免重复检测
            i = j + consecutiveMatch;
            break;
          }
        }
      }
    }
  }

  // 4. 验证循环有效性（减少误判）
  function verifyCycleValidity(startIdx: number, matchIdx: number, cycleTime: number): boolean {
    // 1. 排除过短循环（小于最小循环时长）
    if (cycleTime < minCycleTime) {
      logger.debug(`✗ 循环过短被拒绝: ${cycleTime.toFixed(0)}ms < ${minCycleTime}ms`);
      return false;
    }

    // 2. 验证循环区间内帧的连续性（哈希差异无突变）
    const cycleFrameCount = matchIdx - startIdx;
    for (let k = 0; k < cycleFrameCount - 1; k++) {
      const diff = calculateHashDiff(frameHashes[startIdx + k], frameHashes[startIdx + k + 1]);
      if (diff > hashDiffThreshold * 2) { // 允许2倍阈值波动（兼容轻微帧噪声）
        logger.debug(`✗ 循环内帧跳变被拒绝: 帧${startIdx + k}-${startIdx + k + 1} 差异${diff} > ${hashDiffThreshold * 2}`);
        return false;
      }
    }

    // 3. 验证存在两段完整且相似的循环（要求所有帧连续循环两次）
    const secondCycleStart = matchIdx;
    const secondCycleEnd = secondCycleStart + cycleFrameCount - 1;
    if (secondCycleEnd >= frameCount) {
      logger.debug(`✗ 不满足两段完整循环: 需要到帧${secondCycleEnd}，但总帧数为${frameCount}`);
      return false;
    }
    for (let k = 0; k < cycleFrameCount; k++) {
      const diff = calculateHashDiff(frameHashes[startIdx + k], frameHashes[secondCycleStart + k]);
      if (diff > hashDiffThreshold) {
        logger.debug(`✗ 第二段循环与第一段不一致: 帧${startIdx + k} vs ${secondCycleStart + k} 差异${diff} > ${hashDiffThreshold}`);
        return false;
      }
    }

    return true;
  }

  // 5. 计算两个哈希的差异（汉明距离，快速对比）
  function calculateHashDiff(hash1: string, hash2: string): number {
    let diff = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) diff++;
      if (diff > hashDiffThreshold) break; // 超过阈值，提前退出（优化性能）
    }
    return diff;
  }

  // 执行核心检测流程
  findCycleBoundaries();

  logger.log(`循环检测完成，共找到 ${cycleBoundaries.length} 个循环边界`);

  return cycleBoundaries;
}


export const cycleDetectProcessor: ImageProcessor = async (imageDataList, config) => {
  const { logger, frameRate } = config

  const cycleBoundaries = detectCycle(imageDataList, { logger, frameRate })
  config.cycleBoundaries = cycleBoundaries

  if (cycleBoundaries.length > 0) {
    const largestCycle = cycleBoundaries.reduce((max, cur) =>
      cur.cycleFrameCount > max.cycleFrameCount ? cur : max,
      cycleBoundaries[0]
    )
    logger.log(`将使用最长的循环片段: 帧${largestCycle.startFrame}-${largestCycle.endFrame}，共 ${largestCycle.cycleFrameCount} 帧`)
    return imageDataList.slice(largestCycle.startFrame, largestCycle.endFrame + 1)
  }

  logger.log('未检测到循环，使用全部帧！！！！！')
  logger.log('提示：可以尝试录制更长的视频以提高循环检测成功率')
  return imageDataList
}
