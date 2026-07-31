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
      <div id="finish-card" class="finish-card" hidden>
        <div>✦ ✧ ✦</div>
        <p>The royal look is ready</p>
        <h1>Pure magic!</h1>
        <button type="button" id="play-again">Make another look</button>
      </div>
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
const finishCard = document.querySelector<HTMLDivElement>('#finish-card')!

const makeMask = () => {
  const canvas = document.createElement('canvas')
  canvas.width = ART_WIDTH
  canvas.height = ART_HEIGHT
  return canvas
}

const targetMask = makeMask()
const rawBrushMask = makeMask()
const activeMask = makeMask()
const lockedMask = makeMask()
const compositeMask = makeMask()
const targetCtx = targetMask.getContext('2d')!
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
let helperTimer: number | undefined

const finishedPortrait = new Image()
finishedPortrait.src = ASSET_MANIFEST.princessFinished

const currentStep = () => steps[currentStepIndex]
const toolSource = (id: MakeupId) => ASSET_MANIFEST.tools[id]

const withPath = (context: CanvasRenderingContext2D, step: MakeupStep, fill: boolean) => {
  context.beginPath()
  if (step.id === 'blush') {
    context.ellipse(355, 665, 96, 65, -0.16, 0, Math.PI * 2)
    context.ellipse(767, 665, 96, 65, 0.16, 0, Math.PI * 2)
  }
  if (step.id === 'shadow') {
    context.moveTo(337, 537); context.quadraticCurveTo(423, 464, 511, 534); context.quadraticCurveTo(422, 558, 337, 537); context.closePath()
    context.moveTo(611, 534); context.quadraticCurveTo(699, 464, 785, 537); context.quadraticCurveTo(700, 558, 611, 534); context.closePath()
  }
  if (step.id === 'mascara') {
    context.moveTo(338, 520); context.quadraticCurveTo(422, 485, 508, 520)
    context.moveTo(614, 520); context.quadraticCurveTo(700, 485, 784, 520)
  }
  if (step.id === 'lips') {
    context.moveTo(459, 726)
    context.quadraticCurveTo(488, 702, 528, 714)
    context.quadraticCurveTo(559, 694, 592, 714)
    context.quadraticCurveTo(632, 702, 663, 726)
    context.quadraticCurveTo(621, 764, 561, 769)
    context.quadraticCurveTo(501, 764, 459, 726)
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
    context.lineWidth = fill ? 21 : 15
    context.stroke()
  } else if (fill) context.fill()
  else context.stroke()
}

const drawGuide = (step: MakeupStep) => {
  guideCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  guideCtx.save()
  guideCtx.strokeStyle = 'rgba(255, 234, 164, .96)'
  guideCtx.shadowColor = '#bd7c32'
  guideCtx.shadowBlur = 13
  guideCtx.lineWidth = step.id === 'mascara' ? 12 : 7
  guideCtx.setLineDash(step.id === 'mascara' ? [11, 9] : [14, 11])
  withPath(guideCtx, step, false)
  guideCtx.restore()
}

const drawTargetMask = (step: MakeupStep) => {
  targetCtx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)
  targetCtx.save()
  targetCtx.fillStyle = '#ffffff'
  targetCtx.strokeStyle = '#ffffff'
  withPath(targetCtx, step, true)
  targetCtx.restore()
  targetPixels = targetCtx.getImageData(0, 0, ART_WIDTH, ART_HEIGHT).data
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
  activeMaskCtx.drawImage(targetMask, 0, 0)
  activeMaskCtx.globalCompositeOperation = 'source-over'
  renderReveal()

  samples.forEach((sample, index) => {
    const dx = sample.x - point.x
    const dy = sample.y - point.y
    if (dx * dx + dy * dy <= radius * radius * 0.72) covered.add(index)
  })
  updateProgress()
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
  lockedMaskCtx.drawImage(targetMask, 0, 0)
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
      finishCard.hidden = false
      finishCard.classList.add('show')
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
  if (isFinishing || !finishCard.hidden) {
    toolCursor.classList.remove('shown')
    return
  }
  toolCursor.style.left = `${event.clientX}px`
  toolCursor.style.top = `${event.clientY}px`
  toolCursor.classList.add('shown')
}

paintCanvas.addEventListener('pointerdown', (event) => {
  if (!finishCard.hidden) return
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
document.querySelector<HTMLButtonElement>('#play-again')!.addEventListener('click', () => window.location.reload())

finishedPortrait.addEventListener('load', () => prepareStep(), { once: true })
if (finishedPortrait.complete) prepareStep()
