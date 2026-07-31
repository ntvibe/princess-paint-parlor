import './style.css'
import { ASSET_MANIFEST } from './assets'

type Point = { x: number; y: number }
type MakeupId = 'blush' | 'shadow' | 'mascara' | 'lips' | 'sparkles'

type MakeupStep = {
  id: MakeupId
  name: string
  label: string
  instruction: string
  help: string
  brushSize: number
}

const ART_WIDTH = 1122
const ART_HEIGHT = 1402
const steps: MakeupStep[] = [
  { id: 'blush', name: 'Rosy Blush', label: 'Blush', instruction: 'Brush only inside the golden cheek shapes.', help: 'Soft circles make the rosy glow.', brushSize: 78 },
  { id: 'shadow', name: 'Lavender Shadow', label: 'Eyes', instruction: 'Sweep the brush inside both golden eyelids.', help: 'A little purple magic goes a long way.', brushSize: 54 },
  { id: 'mascara', name: 'Twinkle Lashes', label: 'Lashes', instruction: 'Trace gently along both golden lash lines.', help: 'Slow strokes make neat lashes.', brushSize: 32 },
  { id: 'lips', name: 'Berry Smile', label: 'Lips', instruction: 'Color just inside the tiny golden smile.', help: 'Follow the lip shape from side to side.', brushSize: 42 },
  { id: 'sparkles', name: 'Fairy Sparkles', label: 'Magic', instruction: 'Tap every little golden sparkle star!', help: 'Tap, tap — the fairy dust will appear.', brushSize: 35 },
]

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="game-shell">
    <img class="scene-backdrop" src="${ASSET_MANIFEST.princessBase}" alt="" aria-hidden="true" />
    <div class="scene-wash" aria-hidden="true"></div>

    <section class="top-hud" aria-label="Game controls">
      <div class="brand"><span class="brand-crown">♕</span><span>Princess<br /><b>Paint Parlor</b></span></div>
      <div class="step-counter" id="step-counter">1 <small>of</small> 5</div>
      <button class="reset-button" id="reset-button" type="button">↺ <span>Start over</span></button>
    </section>

    <div id="portrait-stage" class="portrait-stage" aria-label="Princess makeup canvas">
      <img class="portrait-image" src="${ASSET_MANIFEST.princessBase}" alt="Princess ready for makeup" />
      <canvas id="reveal-canvas" width="${ART_WIDTH}" height="${ART_HEIGHT}" aria-hidden="true"></canvas>
      <canvas id="guide-canvas" width="${ART_WIDTH}" height="${ART_HEIGHT}" aria-hidden="true"></canvas>
      <canvas id="paint-canvas" width="${ART_WIDTH}" height="${ART_HEIGHT}" aria-label="Paint inside the golden guide using the current makeup tool"></canvas>
      <div id="sparkle-field" class="sparkle-field" aria-hidden="true"></div>
    </div>

    <section class="bottom-dock" aria-live="polite">
      <div class="instruction-glass">
        <img id="active-tool-image" src="${ASSET_MANIFEST.tools.blush}" alt="" />
        <div><p id="step-name">Rosy Blush</p><h1 id="instruction">Brush only inside the golden cheek shapes.</h1></div>
        <button id="magic-help" type="button" title="Use a little fairy magic">✦<span>Help</span></button>
      </div>
      <div class="progress-line"><span id="progress-label">Blush</span><div><i id="progress-fill"></i></div><b id="progress-value">0%</b></div>
      <nav id="tool-tray" class="tool-tray" aria-label="Makeup steps"></nav>
    </section>
  </main>
  <div id="tool-cursor" class="tool-cursor" aria-hidden="true"><img id="cursor-image" src="${ASSET_MANIFEST.tools.blush}" alt="" /></div>
`

const gameShell = document.querySelector<HTMLElement>('.game-shell')!
const stage = document.querySelector<HTMLDivElement>('#portrait-stage')!
const paintCanvas = document.querySelector<HTMLCanvasElement>('#paint-canvas')!
const revealCanvas = document.querySelector<HTMLCanvasElement>('#reveal-canvas')!
const guideCanvas = document.querySelector<HTMLCanvasElement>('#guide-canvas')!
const revealCtx = revealCanvas.getContext('2d')!
const guideCtx = guideCanvas.getContext('2d')!
const sparkleField = document.querySelector<HTMLDivElement>('#sparkle-field')!
const toolCursor = document.querySelector<HTMLDivElement>('#tool-cursor')!
const cursorImage = document.querySelector<HTMLImageElement>('#cursor-image')!
const activeToolImage = document.querySelector<HTMLImageElement>('#active-tool-image')!
const stepCounter = document.querySelector<HTMLDivElement>('#step-counter')!
const stepName = document.querySelector<HTMLParagraphElement>('#step-name')!
const instruction = document.querySelector<HTMLHeadingElement>('#instruction')!
const progressLabel = document.querySelector<HTMLSpanElement>('#progress-label')!
const progressFill = document.querySelector<HTMLElement>('#progress-fill')!
const progressValue = document.querySelector<HTMLElement>('#progress-value')!
const toolTray = document.querySelector<HTMLElement>('#tool-tray')!

const makeMask = () => {
  const canvas = document.createElement('canvas')
  canvas.width = ART_WIDTH
  canvas.height = ART_HEIGHT
  return canvas
}

const targetMask = makeMask()
const softTargetMask = makeMask()
const guideTemplate = makeMask()
const rawBrushMask = makeMask()
const activeMask = makeMask()
const lockedMask = makeMask()
const compositeMask = makeMask()
const targetCtx = targetMask.getContext('2d')!
const softTargetCtx = softTargetMask.getContext('2d')!
const guideTemplateCtx = guideTemplate.getContext('2d')!
const rawBrushCtx = rawBrushMask.getContext('2d')!
const activeMaskCtx = activeMask.getContext('2d')!
const lockedMaskCtx = lockedMask.getContext('2d')!
const compositeMaskCtx = compositeMask.getContext('2d')!

let currentStepIndex = 0
let samples: Point[] = []
let targetPixels = new Uint8ClampedArray()
let covered = new Set<number>()
let isPainting = false
let lastPoint: Point | undefined
let isFinishing = false
let isFinalLook = false
let helperTimer: number | undefined

const finishedPortrait = new Image()
finishedPortrait.src = ASSET_MANIFEST.princessFinished

const currentStep = () => steps[currentStepIndex]
const toolSource = (id: MakeupId) => ASSET_MANIFEST.tools[id]
const cursorTipOffsets: Record<MakeupId, { x: string; y: string }> = {
  blush: { x: '-92%', y: '-4%' },
  shadow: { x: '-87%', y: '-6%' },
  mascara: { x: '-78%', y: '-5%' },
  lips: { x: '-75%', y: '-4%' },
  sparkles: { x: '-91%', y: '-4%' },
}

const withPath = (context: CanvasRenderingContext2D, step: MakeupStep, fill: boolean) => {
  context.beginPath()
  if (step.id === 'blush') {
    // These deliberately trace the two pink areas in the finished portrait rather
    // than using oversized circles, so reveal pixels never spill across the nose,
    // eyes, or jawline.
    context.moveTo(278, 659)
    context.bezierCurveTo(284, 620, 320, 595, 364, 597)
    context.bezierCurveTo(409, 599, 444, 630, 447, 667)
    context.bezierCurveTo(447, 704, 411, 731, 365, 735)
    context.bezierCurveTo(319, 737, 283, 708, 278, 659)
    context.closePath()
    context.moveTo(675, 667)
    context.bezierCurveTo(678, 630, 713, 599, 758, 597)
    context.bezierCurveTo(802, 595, 838, 620, 844, 659)
    context.bezierCurveTo(839, 708, 803, 737, 757, 735)
    context.bezierCurveTo(711, 731, 675, 704, 675, 667)
    context.closePath()
  }
  if (step.id === 'shadow') {
    context.moveTo(344, 528)
    context.bezierCurveTo(366, 487, 410, 476, 456, 487)
    context.bezierCurveTo(480, 493, 500, 510, 510, 530)
    context.bezierCurveTo(472, 516, 431, 513, 391, 520)
    context.bezierCurveTo(371, 524, 355, 530, 344, 528)
    context.closePath()
    context.moveTo(612, 530)
    context.bezierCurveTo(622, 510, 642, 493, 666, 487)
    context.bezierCurveTo(712, 476, 756, 487, 778, 528)
    context.bezierCurveTo(767, 530, 751, 524, 731, 520)
    context.bezierCurveTo(691, 513, 650, 516, 612, 530)
    context.closePath()
  }
  if (step.id === 'mascara') {
    context.moveTo(350, 530); context.quadraticCurveTo(423, 494, 508, 530)
    context.moveTo(614, 530); context.quadraticCurveTo(699, 494, 772, 530)
  }
  if (step.id === 'lips') {
    context.moveTo(467, 728)
    context.bezierCurveTo(487, 710, 508, 709, 528, 719)
    context.bezierCurveTo(545, 705, 566, 705, 582, 719)
    context.bezierCurveTo(605, 709, 630, 712, 650, 729)
    context.bezierCurveTo(627, 748, 596, 758, 560, 759)
    context.bezierCurveTo(525, 758, 493, 747, 467, 728)
    context.closePath()
  }
  if (step.id === 'sparkles') {
    const stars: Point[] = [
      { x: 330, y: 602 }, { x: 366, y: 619 }, { x: 399, y: 605 },
      { x: 723, y: 605 }, { x: 756, y: 619 }, { x: 793, y: 602 },
    ]
    stars.forEach(({ x, y }) => {
      for (let vertex = 0; vertex < 10; vertex += 1) {
        const angle = -Math.PI / 2 + vertex * Math.PI / 5
        const radius = vertex % 2 === 0 ? 17 : 7
        const px = x + Math.cos(angle) * radius
        const py = y + Math.sin(angle) * radius
        if (vertex === 0) context.moveTo(px, py)
        else context.lineTo(px, py)
      }
      context.closePath()
    })
  }
  if (step.id === 'mascara') {
    context.lineCap = 'round'
    context.lineWidth = fill ? 16 : 10
    context.stroke()
  } else if (fill) context.fill()
  else context.stroke()
}

const drawGuide = (step: MakeupStep) => {
  guideTemplateCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  guideTemplateCtx.save()
  guideTemplateCtx.strokeStyle = 'rgba(255, 236, 171, .78)'
  guideTemplateCtx.shadowColor = '#b8772f'
  guideTemplateCtx.shadowBlur = 5
  guideTemplateCtx.lineWidth = step.id === 'mascara' ? 5.5 : 2.4
  guideTemplateCtx.setLineDash(step.id === 'mascara' ? [8, 11] : [10, 15])
  withPath(guideTemplateCtx, step, false)
  guideTemplateCtx.restore()
  renderGuide()
}

const renderGuide = () => {
  const progress = samples.length === 0 ? 0 : covered.size / samples.length
  guideCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  guideCtx.globalAlpha = Math.max(0.08, 1 - progress * 0.93)
  guideCtx.drawImage(guideTemplate, 0, 0)
  guideCtx.globalAlpha = 1
  guideCtx.globalCompositeOperation = 'destination-out'
  guideCtx.drawImage(activeMask, 0, 0)
  guideCtx.globalCompositeOperation = 'source-over'
}

const drawTargetMask = (step: MakeupStep) => {
  targetCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  targetCtx.save()
  targetCtx.fillStyle = '#ffffff'
  targetCtx.strokeStyle = '#ffffff'
  withPath(targetCtx, step, true)
  targetCtx.restore()
  targetPixels = targetCtx.getImageData(0, 0, ART_WIDTH, ART_HEIGHT).data

  // The hit region stays hard-edged for precise painting and progress scoring.
  // The image reveal gets a tiny feather, which lets the pre-rendered makeup
  // blend into the untouched portrait instead of showing a sticker-like edge.
  softTargetCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  softTargetCtx.save()
  softTargetCtx.filter = 'blur(6px)'
  softTargetCtx.drawImage(targetMask, 0, 0)
  softTargetCtx.restore()
}

const buildSamples = (step: MakeupStep) => {
  const spacing = step.id === 'mascara' ? 13 : step.id === 'sparkles' ? 8 : 20
  const next: Point[] = []
  for (let y = spacing / 2; y < ART_HEIGHT; y += spacing) {
    for (let x = spacing / 2; x < ART_WIDTH; x += spacing) {
      const index = (Math.floor(y) * ART_WIDTH + Math.floor(x)) * 4 + 3
      if (targetPixels[index] > 200) next.push({ x, y })
    }
  }
  return next
}

const updateProgress = () => {
  const percent = samples.length === 0 ? 0 : Math.round((covered.size / samples.length) * 100)
  progressFill.style.width = `${percent}%`
  progressValue.textContent = `${percent}%`
}

const renderReveal = () => {
  compositeMaskCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  compositeMaskCtx.drawImage(lockedMask, 0, 0)
  compositeMaskCtx.drawImage(activeMask, 0, 0)
  revealCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  revealCtx.drawImage(finishedPortrait, 0, 0, ART_WIDTH, ART_HEIGHT)
  revealCtx.globalCompositeOperation = 'destination-in'
  revealCtx.drawImage(compositeMask, 0, 0)
  revealCtx.globalCompositeOperation = 'source-over'
}

const isInsideTarget = (point: Point) => {
  const x = Math.round(point.x)
  const y = Math.round(point.y)
  if (x < 0 || x >= ART_WIDTH || y < 0 || y >= ART_HEIGHT) return false
  return targetPixels[(y * ART_WIDTH + x) * 4 + 3] > 20
}

const stamp = (point: Point, strength = 1) => {
  const step = currentStep()
  if (!isInsideTarget(point) || isFinishing) return
  const radius = step.brushSize * strength
  const gradient = rawBrushCtx.createRadialGradient(point.x, point.y, radius * 0.08, point.x, point.y, radius)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.68, 'rgba(255,255,255,.94)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  rawBrushCtx.fillStyle = gradient
  rawBrushCtx.beginPath()
  rawBrushCtx.arc(point.x, point.y, radius, 0, Math.PI * 2)
  rawBrushCtx.fill()

  activeMaskCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  activeMaskCtx.drawImage(rawBrushMask, 0, 0)
  activeMaskCtx.globalCompositeOperation = 'destination-in'
  activeMaskCtx.drawImage(softTargetMask, 0, 0)
  activeMaskCtx.globalCompositeOperation = 'source-over'
  renderReveal()

  samples.forEach((sample, index) => {
    const dx = sample.x - point.x
    const dy = sample.y - point.y
    if (dx * dx + dy * dy <= radius * radius * 0.72) covered.add(index)
  })
  updateProgress()
  renderGuide()
  clearHelperTimer()
  if (covered.size / samples.length >= 0.86) finishStep()
  else scheduleHelper()
}

const stampLine = (from: Point, to: Point) => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const parts = Math.max(1, Math.ceil(distance / (currentStep().brushSize * 0.38)))
  for (let part = 0; part <= parts; part += 1) {
    stamp({ x: from.x + (to.x - from.x) * (part / parts), y: from.y + (to.y - from.y) * (part / parts) })
  }
}

const clearHelperTimer = () => {
  if (helperTimer !== undefined) window.clearTimeout(helperTimer)
  helperTimer = undefined
}

const remainingPoints = () => samples
  .map((point, index) => ({ point, index }))
  .filter(({ index }) => !covered.has(index))

const useMagicHelp = (amount = 7) => {
  if (isFinishing) return
  const remaining = remainingPoints()
  remaining.slice(0, amount).forEach(({ point }, index) => {
    window.setTimeout(() => stamp(point, 0.82), index * 90)
  })
  instruction.textContent = 'A tiny fairy is helping with the tricky spots!'
  window.setTimeout(() => { if (!isFinishing) instruction.textContent = currentStep().instruction }, 1150)
}

const scheduleHelper = () => {
  clearHelperTimer()
  if (covered.size < 3) return
  helperTimer = window.setTimeout(() => useMagicHelp(3), 2800)
}

const createSparkleBurst = () => {
  sparkleField.replaceChildren()
  for (let index = 0; index < 22; index += 1) {
    const sparkle = document.createElement('i')
    sparkle.textContent = index % 3 === 0 ? '✦' : '✧'
    sparkle.style.left = `${23 + Math.random() * 54}%`
    sparkle.style.top = `${31 + Math.random() * 28}%`
    sparkle.style.animationDelay = `${index * 25}ms`
    sparkleField.append(sparkle)
  }
  sparkleField.classList.add('burst')
  window.setTimeout(() => { sparkleField.classList.remove('burst'); sparkleField.replaceChildren() }, 1050)
}

const finishStep = () => {
  if (isFinishing) return
  isFinishing = true
  clearHelperTimer()
  lockedMaskCtx.drawImage(softTargetMask, 0, 0)
  rawBrushCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  activeMaskCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  covered = new Set(samples.map((_, index) => index))
  updateProgress()
  renderReveal()
  guideCanvas.classList.add('guide-hidden')
  toolCursor.classList.remove('shown')
  createSparkleBurst()
  instruction.textContent = `Perfect! ${currentStep().name} is complete.`
  window.setTimeout(() => {
    if (currentStepIndex === steps.length - 1) {
      isFinalLook = true
      gameShell.classList.add('final-look')
      toolCursor.classList.remove('shown')
      return
    }
    currentStepIndex += 1
    isFinishing = false
    prepareStep()
  }, 980)
}

const renderTray = () => {
  toolTray.innerHTML = steps.map((step, index) => `
    <div class="tool ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'done' : ''}" aria-current="${index === currentStepIndex ? 'step' : 'false'}">
      <img src="${toolSource(step.id)}" alt="" />
      <span>${step.label}</span>
      ${index < currentStepIndex ? '<b>✓</b>' : ''}
    </div>`).join('')
}

const prepareStep = () => {
  const step = currentStep()
  guideCanvas.classList.remove('guide-hidden')
  rawBrushCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  activeMaskCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  drawTargetMask(step)
  drawGuide(step)
  samples = buildSamples(step)
  covered = new Set()
  stepCounter.innerHTML = `${currentStepIndex + 1} <small>of</small> ${steps.length}`
  stepName.textContent = step.name
  instruction.textContent = step.instruction
  progressLabel.textContent = step.label
  activeToolImage.src = toolSource(step.id)
  cursorImage.src = toolSource(step.id)
  toolCursor.style.setProperty('--tip-x', cursorTipOffsets[step.id].x)
  toolCursor.style.setProperty('--tip-y', cursorTipOffsets[step.id].y)
  renderTray()
  updateProgress()
  renderReveal()
}

const toImagePoint = (event: PointerEvent): Point => {
  const rect = stage.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * ART_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * ART_HEIGHT,
  }
}

const moveToolCursor = (event: PointerEvent) => {
  if (isFinishing || isFinalLook) {
    toolCursor.classList.remove('shown')
    return
  }
  toolCursor.style.left = `${event.clientX}px`
  toolCursor.style.top = `${event.clientY}px`
  toolCursor.classList.add('shown')
}

paintCanvas.addEventListener('pointerdown', (event) => {
  if (isFinalLook) return
  paintCanvas.setPointerCapture(event.pointerId)
  isPainting = true
  moveToolCursor(event)
  lastPoint = toImagePoint(event)
  stamp(lastPoint)
})

paintCanvas.addEventListener('pointermove', (event) => {
  moveToolCursor(event)
  if (!isPainting || !lastPoint) return
  const next = toImagePoint(event)
  stampLine(lastPoint, next)
  lastPoint = next
})

const stopPainting = () => {
  isPainting = false
  lastPoint = undefined
  clearHelperTimer()
  toolCursor.classList.remove('shown')
}

paintCanvas.addEventListener('pointerup', stopPainting)
paintCanvas.addEventListener('pointercancel', stopPainting)
paintCanvas.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') toolCursor.classList.remove('shown') })
paintCanvas.addEventListener('pointerenter', moveToolCursor)

document.querySelector<HTMLButtonElement>('#magic-help')!.addEventListener('click', () => useMagicHelp(7))
document.querySelector<HTMLButtonElement>('#reset-button')!.addEventListener('click', () => window.location.reload())

finishedPortrait.addEventListener('load', () => prepareStep(), { once: true })
if (finishedPortrait.complete) prepareStep()
