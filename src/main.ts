import './style.css'
import { createPortraitGame, STAGE_HEIGHT, STAGE_WIDTH } from './game'

type Point = { x: number; y: number }
type Zone = { x: number; y: number; rx: number; ry: number }

type MakeupStep = {
  id: 'blush' | 'shadow' | 'mascara' | 'lips' | 'sparkles'
  title: string
  shortTitle: string
  instruction: string
  helper: string
  color: string
  icon: string
  zones: Zone[]
  points: Point[]
}

const ellipsePoints = (zone: Zone, columns: number, rows: number) => {
  const points: Point[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = zone.x - zone.rx + ((col + 0.5) / columns) * zone.rx * 2
      const y = zone.y - zone.ry + ((row + 0.5) / rows) * zone.ry * 2
      const nx = (x - zone.x) / zone.rx
      const ny = (y - zone.y) / zone.ry
      if (nx * nx + ny * ny <= 0.92) points.push({ x, y })
    }
  }
  return points
}

const makePoints = (zones: Zone[], columns: number, rows: number) => zones.flatMap((zone) => ellipsePoints(zone, columns, rows))

const steps: MakeupStep[] = [
  {
    id: 'blush', title: 'Rosy Cheeks', shortTitle: 'Blush', icon: '🖌️', color: '#f16e9a',
    instruction: 'Brush all the glowing cheek petals!', helper: 'Tiny circles make the prettiest rosy cheeks.',
    zones: [{ x: 342, y: 652, rx: 105, ry: 70 }, { x: 657, y: 652, rx: 105, ry: 70 }],
    points: [],
  },
  {
    id: 'shadow', title: 'Lavender Eye Shadow', shortTitle: 'Eye shadow', icon: '🪄', color: '#a969d4',
    instruction: 'Sweep lavender across both eyelids.', helper: 'Follow the little crescent shapes above her eyes.',
    zones: [{ x: 365, y: 537, rx: 105, ry: 31 }, { x: 635, y: 537, rx: 105, ry: 31 }],
    points: [],
  },
  {
    id: 'mascara', title: 'Twinkle Lashes', shortTitle: 'Mascara', icon: '🖋️', color: '#3b2136',
    instruction: 'Gently paint along the sparkling lash line.', helper: 'Short, careful strokes make her lashes twinkle.',
    zones: [{ x: 365, y: 518, rx: 108, ry: 15 }, { x: 635, y: 518, rx: 108, ry: 15 }],
    points: [],
  },
  {
    id: 'lips', title: 'Berry Smile', shortTitle: 'Lip color', icon: '💄', color: '#d94169',
    instruction: 'Color the shining heart-shaped smile.', helper: 'Glide slowly from one side of her smile to the other.',
    zones: [{ x: 500, y: 744, rx: 106, ry: 43 }],
    points: [],
  },
  {
    id: 'sparkles', title: 'Fairy Sparkles', shortTitle: 'Sparkles', icon: '✨', color: '#f7ce5d',
    instruction: 'Tap and swirl over every magic star!', helper: 'Sprinkle a little gold magic on her cheeks.',
    zones: [{ x: 290, y: 628, rx: 72, ry: 38 }, { x: 710, y: 628, rx: 72, ry: 38 }],
    points: [],
  },
]

steps.forEach((step) => {
  const density = step.id === 'mascara' ? [11, 2] : step.id === 'sparkles' ? [5, 2] : [6, 4]
  step.points = makePoints(step.zones, density[0], density[1])
})

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="parlor-shell">
    <header class="topbar">
      <div class="brand" aria-label="Princess Paint Parlor"><span class="brand-crown">♕</span><span>Princess<br /><b>Paint Parlor</b></span></div>
      <div class="step-pill" id="step-pill">1 <span>of</span> 5</div>
      <button id="reset" class="reset-button" type="button" aria-label="Start over">↺ <span>Start over</span></button>
    </header>

    <section class="play-area" aria-label="Princess makeup game">
      <div class="portrait-frame" id="portrait-frame">
        <div class="frame-lights" aria-hidden="true"></div>
        <div id="portrait-game" aria-hidden="true"></div>
        <canvas id="paint-canvas" width="${STAGE_WIDTH}" height="${STAGE_HEIGHT}" aria-label="Use the selected makeup tool here"></canvas>
        <div id="guide-layer" class="guide-layer" aria-hidden="true"></div>
        <div id="finish-card" class="finish-card" hidden>
          <div class="finish-stars">✦ ✧ ✦</div>
          <p class="finish-kicker">The royal look is ready!</p>
          <h1>Beautifully magical!</h1>
          <p>You made a one-of-a-kind princess look.</p>
          <button type="button" id="play-again">Make another look</button>
        </div>
      </div>
    </section>

    <section class="instruction-card" aria-live="polite">
      <div class="instruction-icon" id="instruction-icon">🖌️</div>
      <div class="instruction-copy"><p id="step-name">Rosy Cheeks</p><h2 id="instruction">Brush all the glowing cheek petals!</h2></div>
      <button id="magic-help" type="button" class="magic-help" aria-label="Get magic help">✦<span>Magic help</span></button>
    </section>

    <section class="progress-section" aria-label="Makeup progress">
      <div class="progress-label"><span id="progress-title">Rosy cheeks</span><span id="progress-value">0%</span></div>
      <div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div>
    </section>

    <nav class="tool-tray" aria-label="Makeup steps" id="tool-tray"></nav>
  </main>
  <div id="tool-follower" class="tool-follower" aria-hidden="true"></div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#paint-canvas')!
const ctx = canvas.getContext('2d')!
const frame = document.querySelector<HTMLDivElement>('#portrait-frame')!
const guideLayer = document.querySelector<HTMLDivElement>('#guide-layer')!
const toolFollower = document.querySelector<HTMLDivElement>('#tool-follower')!
const progressFill = document.querySelector<HTMLDivElement>('#progress-fill')!
const progressValue = document.querySelector<HTMLSpanElement>('#progress-value')!
const progressTitle = document.querySelector<HTMLSpanElement>('#progress-title')!
const stepName = document.querySelector<HTMLParagraphElement>('#step-name')!
const instruction = document.querySelector<HTMLHeadingElement>('#instruction')!
const instructionIcon = document.querySelector<HTMLDivElement>('#instruction-icon')!
const stepPill = document.querySelector<HTMLDivElement>('#step-pill')!
const tray = document.querySelector<HTMLElement>('#tool-tray')!
const finishCard = document.querySelector<HTMLDivElement>('#finish-card')!

createPortraitGame('portrait-game')

let currentStep = 0
let active = false
let complete = false
let touched = new Set<number>()
let helperTimer: number | undefined
let lastPoint: Point | undefined

const current = () => steps[currentStep]

const percentage = () => touched.size / current().points.length

const clearTimer = () => {
  if (helperTimer !== undefined) window.clearTimeout(helperTimer)
  helperTimer = undefined
}

const zoneContains = (point: Point, zone: Zone, padding = 0) => {
  const dx = (point.x - zone.x) / (zone.rx + padding)
  const dy = (point.y - zone.y) / (zone.ry + padding)
  return dx * dx + dy * dy <= 1
}

const pointIsUseful = (point: Point) => current().zones.some((zone) => zoneContains(point, zone, 27))

const drawGuide = () => {
  guideLayer.replaceChildren()
  current().zones.forEach((zone) => {
    const petal = document.createElement('div')
    petal.className = `guide-petal guide-${current().id}`
    petal.style.left = `${(zone.x / STAGE_WIDTH) * 100}%`
    petal.style.top = `${(zone.y / STAGE_HEIGHT) * 100}%`
    petal.style.width = `${(zone.rx * 2 / STAGE_WIDTH) * 100}%`
    petal.style.height = `${(zone.ry * 2 / STAGE_HEIGHT) * 100}%`
    guideLayer.append(petal)
  })
}

const toolMarkup = (step: MakeupStep, index: number) => `
  <button class="tool ${index === currentStep ? 'selected' : ''} ${index < currentStep ? 'done' : ''}" type="button" data-step="${index}" ${index > currentStep ? 'disabled' : ''} aria-label="${step.title}">
    <span class="tool-art tool-${step.id}"><i>${step.icon}</i></span>
    <span>${step.shortTitle}</span>
    ${index < currentStep ? '<b>✓</b>' : ''}
  </button>`

const renderTray = () => { tray.innerHTML = steps.map(toolMarkup).join('') }

const updateFollower = (event: PointerEvent) => {
  toolFollower.style.left = `${event.clientX}px`
  toolFollower.style.top = `${event.clientY}px`
  toolFollower.innerHTML = `<span class="follower-art tool-${current().id}">${current().icon}</span>`
  toolFollower.classList.add('shown')
}

const hideFollower = () => toolFollower.classList.remove('shown')

const updateProgress = () => {
  const progress = Math.min(1, percentage())
  const value = Math.round(progress * 100)
  progressFill.style.width = `${value}%`
  progressValue.textContent = `${value}%`
}

const drawDab = (point: Point, force = 1) => {
  const step = current()
  ctx.save()
  if (step.id === 'blush') {
    const gradient = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, 46)
    gradient.addColorStop(0, 'rgba(239, 88, 137, .25)')
    gradient.addColorStop(0.58, 'rgba(241, 110, 154, .14)')
    gradient.addColorStop(1, 'rgba(241, 110, 154, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath(); ctx.ellipse(point.x, point.y, 42 * force, 30 * force, 0, 0, Math.PI * 2); ctx.fill()
  } else if (step.id === 'shadow') {
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 33)
    gradient.addColorStop(0, 'rgba(180, 109, 224, .40)')
    gradient.addColorStop(1, 'rgba(180, 109, 224, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath(); ctx.ellipse(point.x, point.y, 37 * force, 17 * force, 0, 0, Math.PI * 2); ctx.fill()
  } else if (step.id === 'mascara') {
    ctx.strokeStyle = 'rgba(56, 31, 50, .82)'
    ctx.lineWidth = 7 * force
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(point.x - 13, point.y + 3); ctx.quadraticCurveTo(point.x, point.y - 8, point.x + 13, point.y + 2); ctx.stroke()
    ctx.lineWidth = 3 * force
    ctx.beginPath(); ctx.moveTo(point.x + 7, point.y - 2); ctx.lineTo(point.x + 14, point.y - 13); ctx.stroke()
  } else if (step.id === 'lips') {
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 28)
    gradient.addColorStop(0, 'rgba(215, 48, 92, .73)')
    gradient.addColorStop(1, 'rgba(215, 48, 92, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath(); ctx.ellipse(point.x, point.y, 29 * force, 17 * force, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255, 229, 121, .96)'
    ctx.shadowBlur = 15; ctx.shadowColor = '#ffcf56'
    ctx.font = `${40 * force}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✦', point.x, point.y)
  }
  ctx.restore()
}

const paint = (point: Point) => {
  if (!pointIsUseful(point) || complete) return
  drawDab(point)
  current().points.forEach((target, index) => {
    const dx = target.x - point.x
    const dy = target.y - point.y
    const radius = current().id === 'mascara' ? 25 : 46
    if (dx * dx + dy * dy < radius * radius) touched.add(index)
  })
  updateProgress()
  clearTimer()
  if (percentage() >= 0.9) finishStep()
  else scheduleFairyHelp()
}

const paintLine = (from: Point, to: Point) => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const segments = Math.max(1, Math.ceil(distance / 18))
  for (let index = 1; index <= segments; index += 1) {
    paint({ x: from.x + ((to.x - from.x) * index) / segments, y: from.y + ((to.y - from.y) * index) / segments })
  }
}

const remaining = () => current().points
  .map((point, index) => ({ point, index }))
  .filter(({ index }) => !touched.has(index))

const fairyHelp = (amount = 6) => {
  if (complete) return
  const missing = remaining()
  missing.slice(0, amount).forEach(({ point, index }, order) => {
    window.setTimeout(() => {
      drawDab(point, 0.9)
      touched.add(index)
      updateProgress()
      if (percentage() >= 0.9) finishStep()
    }, order * 80)
  })
  instruction.textContent = 'A little fairy magic is helping you!'
  window.setTimeout(() => { if (!complete) instruction.textContent = current().instruction }, 1100)
}

const scheduleFairyHelp = () => {
  clearTimer()
  helperTimer = window.setTimeout(() => {
    if (active && percentage() < 0.9 && touched.size > 2) fairyHelp(3)
  }, 2800)
}

const finishStep = () => {
  if (complete) return
  complete = true
  clearTimer()
  remaining().forEach(({ point, index }, order) => {
    window.setTimeout(() => { drawDab(point, 0.85); touched.add(index) }, order * 16)
  })
  touched = new Set(current().points.map((_, index) => index))
  updateProgress()
  guideLayer.classList.add('vanish')
  instruction.textContent = `Perfect! ${current().title} is ready!`
  frame.classList.add('celebrate')
  window.setTimeout(() => {
    frame.classList.remove('celebrate')
    if (currentStep === steps.length - 1) {
      finishCard.hidden = false
      finishCard.classList.add('show')
      hideFollower()
    } else {
      currentStep += 1
      complete = false
      touched = new Set()
      renderStep()
    }
  }, 1050)
}

const renderStep = () => {
  const step = current()
  guideLayer.classList.remove('vanish')
  stepName.textContent = step.title
  instruction.textContent = step.instruction
  instructionIcon.textContent = step.icon
  progressTitle.textContent = step.shortTitle
  stepPill.innerHTML = `${currentStep + 1} <span>of</span> ${steps.length}`
  updateProgress()
  drawGuide()
  renderTray()
}

const toStagePoint = (event: PointerEvent): Point => {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * STAGE_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * STAGE_HEIGHT,
  }
}

canvas.addEventListener('pointerdown', (event) => {
  if (finishCard.hidden === false) return
  active = true
  canvas.setPointerCapture(event.pointerId)
  updateFollower(event)
  const point = toStagePoint(event)
  lastPoint = point
  paint(point)
})

canvas.addEventListener('pointermove', (event) => {
  updateFollower(event)
  if (!active || !lastPoint) return
  const point = toStagePoint(event)
  paintLine(lastPoint, point)
  lastPoint = point
})

const endPaint = () => { active = false; lastPoint = undefined; clearTimer(); hideFollower() }
canvas.addEventListener('pointerup', endPaint)
canvas.addEventListener('pointercancel', endPaint)
canvas.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') hideFollower() })
canvas.addEventListener('pointerenter', updateFollower)

document.querySelector<HTMLButtonElement>('#magic-help')!.addEventListener('click', () => fairyHelp(8))
document.querySelector<HTMLButtonElement>('#reset')!.addEventListener('click', () => window.location.reload())
document.querySelector<HTMLButtonElement>('#play-again')!.addEventListener('click', () => window.location.reload())

tray.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.tool')
  if (!button || button.disabled) return
  const stepIndex = Number(button.dataset.step)
  if (stepIndex === currentStep) return
  currentStep = stepIndex
  complete = false
  touched = new Set()
  renderStep()
})

renderStep()
