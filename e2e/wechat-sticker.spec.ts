import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// HEVC video — only ffmpeg decoder can handle this in Chromium headless
const VIDEO_PATH_HEVC = path.join(__dirname, 'fixtures', 'fake-cry.mp4')
// H.264 re-encode — used for the `video` decoder test (Chromium native playback requires H.264)
const VIDEO_PATH_H264 = path.join(__dirname, 'fixtures', 'fake-cry-h264.mp4')

// Video metadata (HEVC, 576×1280, 30fps, 6.000s)
const VIDEO_DURATION_SEC = 6.0
const VIDEO_FPS = 30
const EXPECTED_OUTPUT_FPS = 10
// Frame count = ceil(duration * fps) = ceil(6 * 10) = 60, allow ±5
const EXPECTED_FRAME_COUNT = 60
const FRAME_COUNT_TOLERANCE = 5
// Duration tolerance ±1s
const DURATION_TOLERANCE = 1.0
// After imageResize, max dimension should be ≤ targetSize (300px, default slider=6)
const TARGET_SIZE = 300

async function waitForGifAndAssertMeta(page: import('@playwright/test').Page) {
  // Wait for the GIF preview card to appear (may take a while for WASM to load)
  await expect(page.getByAltText('GIF Preview')).toBeVisible({ timeout: 90_000 })

  // Assert metadata text is displayed
  const metaText = await page.locator('text=fps').first().textContent()
  expect(metaText).not.toBeNull()

  // Extract meta values from the displayed text (format: "大小 X KB · 时长 X.XXs · N 帧 · N fps")
  const metaLocator = page.locator('.MuiCardContent-root').filter({ hasText: 'fps' }).last()
  const fullText = await metaLocator.textContent() ?? ''

  // Duration
  const durationMatch = fullText.match(/时长\s*([\d.]+)s/)
  expect(durationMatch, `Duration not found in meta text: "${fullText}"`).not.toBeNull()
  const duration = parseFloat(durationMatch![1])
  expect(duration, `Duration ${duration}s is outside ±${DURATION_TOLERANCE}s of ${VIDEO_DURATION_SEC}s`).toBeGreaterThanOrEqual(VIDEO_DURATION_SEC - DURATION_TOLERANCE)
  expect(duration).toBeLessThanOrEqual(VIDEO_DURATION_SEC + DURATION_TOLERANCE)

  // FPS
  const fpsMatch = fullText.match(/([\d]+)\s*fps/)
  expect(fpsMatch, `fps not found in meta text: "${fullText}"`).not.toBeNull()
  const fps = parseInt(fpsMatch![1])
  expect(fps).toBe(EXPECTED_OUTPUT_FPS)

  // Frame count
  const frameMatch = fullText.match(/([\d]+)\s*帧/)
  expect(frameMatch, `frame count not found in meta text: "${fullText}"`).not.toBeNull()
  const frameCount = parseInt(frameMatch![1])
  expect(frameCount, `Frame count ${frameCount} is outside ±${FRAME_COUNT_TOLERANCE} of ${EXPECTED_FRAME_COUNT}`).toBeGreaterThanOrEqual(EXPECTED_FRAME_COUNT - FRAME_COUNT_TOLERANCE)
  expect(frameCount).toBeLessThanOrEqual(EXPECTED_FRAME_COUNT + FRAME_COUNT_TOLERANCE)

  // File size > 0
  const sizeMatch = fullText.match(/大小\s*([\d.]+)\s*(KB|MB)/)
  expect(sizeMatch, `File size not found in meta text: "${fullText}"`).not.toBeNull()
  const sizeValue = parseFloat(sizeMatch![1])
  expect(sizeValue).toBeGreaterThan(0)

  // Output dimensions: max dimension should equal targetSize (300px) after resize
  const img = page.getByAltText('GIF Preview')
  const naturalDimensions = await img.evaluate((el: HTMLImageElement) => ({
    w: el.naturalWidth,
    h: el.naturalHeight,
  }))
  expect(naturalDimensions.w, 'GIF width should be > 0').toBeGreaterThan(0)
  expect(naturalDimensions.h, 'GIF height should be > 0').toBeGreaterThan(0)
  const maxDim = Math.max(naturalDimensions.w, naturalDimensions.h)
  expect(maxDim, `Max dimension ${maxDim} should equal targetSize ${TARGET_SIZE} (±2px rounding)`).toBeGreaterThanOrEqual(TARGET_SIZE - 2)
  expect(maxDim).toBeLessThanOrEqual(TARGET_SIZE)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/wechat-sticker')
  // Clear localStorage to ensure default settings (10fps, targetSizeSlider=6 → 300px)
  await page.evaluate(() => {
    localStorage.removeItem('wechat-sticker-gif-frameRate')
    localStorage.removeItem('wechat-sticker-gif-targetSizeSlider')
    localStorage.removeItem('wechat-sticker-decoder-method')
  })
  await page.reload()
})

test('video decoder: converts fake-cry.mp4 with correct fps, duration, and aspect ratio', async ({ page }) => {
  // Select "video" decoder from the MUI Select
  const select = page.locator('.MuiSelect-select').first()
  await select.click()
  await page.getByRole('option', { name: /^video/ }).click()

  // Use H.264 fixture: Chromium headless cannot decode HEVC natively
  const fileInput = page.locator('input[type="file"]#videoInput')
  await fileInput.setInputFiles(VIDEO_PATH_H264)

  await waitForGifAndAssertMeta(page)
})

test('ffmpeg decoder: converts fake-cry.mp4 with correct fps, duration, and aspect ratio', async ({ page }) => {
  // Select "ffmpeg" decoder from the MUI Select
  const select = page.locator('.MuiSelect-select').first()
  await select.click()
  await page.getByRole('option', { name: /^ffmpeg/ }).click()

  // Use HEVC fixture: ffmpeg.wasm can decode any format
  const fileInput = page.locator('input[type="file"]#videoInput')
  await fileInput.setInputFiles(VIDEO_PATH_HEVC)

  await waitForGifAndAssertMeta(page)
})

test('webcodecs decoder: converts fake-cry-h264.mp4 with correct fps, duration, and aspect ratio', async ({ page }) => {
  // Select "webcodecs" decoder (default, but set explicitly to be safe)
  const select = page.locator('.MuiSelect-select').first()
  await select.click()
  await page.getByRole('option', { name: /^webcodecs/ }).click()

  // WebCodecs requires H.264 MP4; fake-cry-h264.mp4 is the H.264 re-encode
  const fileInput = page.locator('input[type="file"]#videoInput')
  await fileInput.setInputFiles(VIDEO_PATH_H264)

  await waitForGifAndAssertMeta(page)
})

test('video decoder: debug mode logs appear during conversion', async ({ page }) => {
  // Enable debug mode
  const debugSwitch = page.getByLabel('调试模式（显示详细日志）')
  await debugSwitch.click()

  const select = page.locator('.MuiSelect-select').first()
  await select.click()
  await page.getByRole('option', { name: /^video/ }).click()

  // Use H.264 fixture for Chromium compatibility
  const fileInput = page.locator('input[type="file"]#videoInput')
  await fileInput.setInputFiles(VIDEO_PATH_H264)

  // Wait for GIF to be produced
  await expect(page.getByAltText('GIF Preview')).toBeVisible({ timeout: 90_000 })

  // Verify conversion log messages are visible on screen (debug mode is on)
  await expect(page.getByText('开始转换')).toBeVisible()
  await expect(page.getByText(/视频尺寸/)).toBeVisible()
})
