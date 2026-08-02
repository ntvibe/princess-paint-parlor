import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

type ToolId = 'blush' | 'shadow' | 'lip' | 'highlight' | 'freckles'

type Tool = {
  id: ToolId
  label: string
  eyebrow: string
  color: string
  size: number
  opacity: number
  blend?: GlobalCompositeOperation
}

const textureSize = 1024
const faceU = 0.25
const faceV = 0.51

const tools: Tool[] = [
  { id: 'blush', label: 'Soft blush', eyebrow: 'Cheeks', color: '#ed7899', size: 86, opacity: 0.23, blend: 'multiply' },
  { id: 'shadow', label: 'Velvet shadow', eyebrow: 'Eyes', color: '#a675d1', size: 50, opacity: 0.32, blend: 'multiply' },
  { id: 'lip', label: 'Rose glaze', eyebrow: 'Lips', color: '#b74368', size: 36, opacity: 0.5, blend: 'source-over' },
  { id: 'highlight', label: 'Pearl light', eyebrow: 'Glow', color: '#fff4dc', size: 42, opacity: 0.32, blend: 'screen' },
  { id: 'freckles', label: 'Sun freckles', eyebrow: 'Details', color: '#b46c58', size: 17, opacity: 0.34, blend: 'multiply' },
]

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="studio-shell">
    <header class="topbar">
      <a class="wordmark" href="#studio" aria-label="Luma Face Studio home">
        <span class="mark">✦</span><span>LUMA<br /><b>FACE STUDIO</b></span>
      </a>
      <div class="mode-readout" id="mode-readout"><i></i><span>Explore the face</span></div>
      <div class="top-actions">
        <div class="look-progress" id="look-progress" aria-live="polite"><span class="progress-orb">✦</span><span><small>Look progress</small><b id="progress-label">0 / 3 touches</b></span></div>
        <button class="quiet-button desktop-only" id="reset-button" type="button">Reset look</button>
        <button class="lock-button" id="lock-button" type="button" aria-pressed="false"><span class="lock-icon">⌾</span><span id="lock-label">Lock to paint</span></button>
      </div>
    </header>

    <section class="studio-layout" id="studio">
      <aside class="tool-panel" aria-label="Makeup tools">
        <div class="panel-heading"><p>Beauty kit</p><h1>Build the look</h1></div>
        <div class="tool-list" id="tool-list"></div>
        <div class="brush-control">
          <div><span>Brush size</span><output id="brush-output">86</output></div>
          <input id="brush-size" type="range" min="18" max="150" value="86" aria-label="Brush size" />
        </div>
        <div class="panel-actions">
          <button id="undo-button" type="button" disabled>↶ Undo</button>
          <button id="clear-button" type="button">Clear canvas</button>
        </div>
      </aside>

      <section class="viewport-wrap" aria-label="3D makeup painting viewport">
        <canvas id="three-canvas"></canvas>
        <div class="viewport-falloff" aria-hidden="true"></div>
        <div class="touch-hint" id="touch-hint"><span class="gesture-icon">⌁</span><div><b>Turn the head</b><small>Drag or pinch to explore the model</small></div></div>
        <div class="paint-indicator" id="paint-indicator" aria-hidden="true"></div>
        <div class="paint-mode-label" id="paint-mode-label" aria-hidden="true"><span>✦</span> Camera locked · paint directly on UV texture</div>
        <div class="view-controls" aria-label="Camera controls">
          <button id="zoom-in" type="button" aria-label="Zoom in">+</button>
          <button id="zoom-out" type="button" aria-label="Zoom out">−</button>
          <button id="front-view" type="button" aria-label="Center front view">◎</button>
        </div>
      </section>

      <aside class="finish-panel">
        <p>Live material</p>
        <h2 id="finish-title">Soft blush</h2>
        <div class="swatch-row" id="swatch-row"></div>
        <div class="finish-copy"><span>UV texture</span><b id="texture-status">Ready</b></div>
        <div class="finish-copy"><span>Brush opacity</span><b id="opacity-status">23%</b></div>
        <div class="production-note"><span>✦</span><p>Makeup is composited into the face’s live texture—not projected over the screen.</p></div>
      </aside>
    </section>

    <section class="mobile-dock" aria-label="Mobile makeup controls">
      <div class="mobile-tool-strip" id="mobile-tool-strip"></div>
      <div class="mobile-dock-bottom"><span id="mobile-tool-name">Soft blush</span><button id="mobile-undo" type="button" disabled>↶</button><button id="mobile-clear" type="button">Clear</button></div>
    </section>
    <div class="toast" id="toast" role="status"></div>
    <section class="reveal" id="reveal" aria-hidden="true" aria-label="Completed makeup look">
      <div class="reveal-card">
        <span class="reveal-sparkle">✦</span>
        <p>LOOK COMPLETE</p>
        <h2>Radiant from every angle</h2>
        <span class="reveal-line"></span>
        <div class="reveal-actions"><button id="keep-painting" type="button">Keep painting</button><button id="save-look" class="primary" type="button">Save look</button></div>
      </div>
    </section>
  </main>
`

const canvas = document.querySelector<HTMLCanvasElement>('#three-canvas')!
const toolList = document.querySelector<HTMLDivElement>('#tool-list')!
const mobileToolStrip = document.querySelector<HTMLDivElement>('#mobile-tool-strip')!
const brushInput = document.querySelector<HTMLInputElement>('#brush-size')!
const brushOutput = document.querySelector<HTMLOutputElement>('#brush-output')!
const undoButton = document.querySelector<HTMLButtonElement>('#undo-button')!
const mobileUndo = document.querySelector<HTMLButtonElement>('#mobile-undo')!
const clearButton = document.querySelector<HTMLButtonElement>('#clear-button')!
const mobileClear = document.querySelector<HTMLButtonElement>('#mobile-clear')!
const lockButton = document.querySelector<HTMLButtonElement>('#lock-button')!
const lockLabel = document.querySelector<HTMLSpanElement>('#lock-label')!
const modeReadout = document.querySelector<HTMLDivElement>('#mode-readout')!
const paintModeLabel = document.querySelector<HTMLDivElement>('#paint-mode-label')!
const touchHint = document.querySelector<HTMLDivElement>('#touch-hint')!
const paintIndicator = document.querySelector<HTMLDivElement>('#paint-indicator')!
const finishTitle = document.querySelector<HTMLHeadingElement>('#finish-title')!
const swatchRow = document.querySelector<HTMLDivElement>('#swatch-row')!
const textureStatus = document.querySelector<HTMLElement>('#texture-status')!
const opacityStatus = document.querySelector<HTMLElement>('#opacity-status')!
const mobileToolName = document.querySelector<HTMLElement>('#mobile-tool-name')!
const toast = document.querySelector<HTMLDivElement>('#toast')!
const progressLabel = document.querySelector<HTMLElement>('#progress-label')!
const lookProgress = document.querySelector<HTMLDivElement>('#look-progress')!
const reveal = document.querySelector<HTMLElement>('#reveal')!
const keepPainting = document.querySelector<HTMLButtonElement>('#keep-painting')!
const saveLook = document.querySelector<HTMLButtonElement>('#save-look')!

let currentTool = tools[0]
let brushSize = currentTool.size
let paintLocked = false
let painting = false
let lastPaint: THREE.Vector2 | undefined
let undoStack: ImageData[] = []
let toastTimer: number | undefined
const coreTools = new Set<ToolId>(['blush', 'shadow', 'lip'])
const exploredTools = new Set<ToolId>()
let lookComplete = false

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.16

const scene = new THREE.Scene()
scene.fog = new THREE.Fog('#2b163f', 7.3, 12)
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
camera.position.set(0, 0.45, 7.1)
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.42, 0)
controls.enableDamping = false
controls.minDistance = 4.2
controls.maxDistance = 8.1
controls.minPolarAngle = 1.12
controls.maxPolarAngle = 2.06
controls.minAzimuthAngle = -1.05
controls.maxAzimuthAngle = 1.05
controls.zoomSpeed = 0.7
controls.rotateSpeed = 0.58
controls.touches.ONE = THREE.TOUCH.ROTATE
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN

const world = new THREE.Group()
world.position.y = -0.22
scene.add(world)

const hemi = new THREE.HemisphereLight('#f8d6ff', '#27122d', 2.35)
scene.add(hemi)
const keyLight = new THREE.DirectionalLight('#ffe3cb', 3.2)
keyLight.position.set(-3, 4, 5)
scene.add(keyLight)
const rimLight = new THREE.PointLight('#b384ff', 20, 7, 2)
rimLight.position.set(3.1, 1.8, -2.8)
scene.add(rimLight)
const fillLight = new THREE.PointLight('#ff93be', 7, 5, 2)
fillLight.position.set(-2.8, -0.2, 3.1)
scene.add(fillLight)

const backdrop = new THREE.Mesh(
  new THREE.SphereGeometry(8, 48, 32),
  new THREE.MeshBasicMaterial({ color: '#5b367d', side: THREE.BackSide, transparent: true, opacity: 0.96 }),
)
backdrop.position.z = -1.9
scene.add(backdrop)

const paintCanvas = document.createElement('canvas')
paintCanvas.width = textureSize
paintCanvas.height = textureSize
const paintContext = paintCanvas.getContext('2d', { willReadFrequently: true })!
const baseTexture = new ImageData(textureSize, textureSize)
const faceTexture = new THREE.CanvasTexture(paintCanvas)
faceTexture.colorSpace = THREE.SRGBColorSpace
faceTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

function canvasPoint(u: number, v: number) {
  return { x: u * textureSize, y: (1 - v) * textureSize }
}

function drawBaseTexture() {
  const gradient = paintContext.createLinearGradient(0, 0, textureSize, textureSize)
  gradient.addColorStop(0, '#d99b82')
  gradient.addColorStop(0.38, '#f5c4ad')
  gradient.addColorStop(0.68, '#f8cbb6')
  gradient.addColorStop(1, '#cc8b75')
  paintContext.fillStyle = gradient
  paintContext.fillRect(0, 0, textureSize, textureSize)

  // A single, stable UV layout: face lives at U=.25, V=.51. The same map receives paint strokes.
  const face = canvasPoint(faceU, faceV)
  paintContext.save()
  paintContext.translate(face.x, face.y)
  paintContext.scale(1, -1)

  const shade = paintContext.createRadialGradient(0, 0, 55, 0, 0, 280)
  shade.addColorStop(0, 'rgba(255,241,225,.28)')
  shade.addColorStop(1, 'rgba(146,74,70,.17)')
  paintContext.fillStyle = shade
  paintContext.beginPath(); paintContext.ellipse(0, 0, 175, 242, 0, 0, Math.PI * 2); paintContext.fill()

  // Brows and natural definition are baked into the base skin layer, while cosmetics remain editable on top.
  paintContext.strokeStyle = 'rgba(77,42,47,.62)'
  paintContext.lineCap = 'round'
  paintContext.lineWidth = 10
  ;[-73, 73].forEach((x) => {
    paintContext.beginPath()
    paintContext.moveTo(x - 39 * Math.sign(x), 72)
    paintContext.quadraticCurveTo(x, 88, x + 39 * Math.sign(x), 74)
    paintContext.stroke()
  })
  paintContext.fillStyle = 'rgba(178,82,105,.34)'
  paintContext.beginPath(); paintContext.ellipse(0, -79, 36, 12, 0, 0, Math.PI * 2); paintContext.fill()
  paintContext.restore()
  baseTexture.data.set(paintContext.getImageData(0, 0, textureSize, textureSize).data)
  faceTexture.needsUpdate = true
}

drawBaseTexture()

const skinMaterial = new THREE.MeshStandardMaterial({
  map: faceTexture,
  color: '#fff8f1',
  roughness: 0.6,
  metalness: 0,
})
const headGeometry = new THREE.SphereGeometry(1, 96, 72)
const head = new THREE.Mesh(headGeometry, skinMaterial)
head.name = 'Paintable UV face'
head.scale.set(1.21, 1.42, 1.08)
head.position.y = 0.6
world.add(head)

const skinDetail = new THREE.MeshStandardMaterial({ color: '#e7a58e', roughness: 0.68 })
const warmSkin = new THREE.MeshStandardMaterial({ color: '#f0b39d', roughness: 0.6 })
const darkHair = new THREE.MeshPhysicalMaterial({ color: '#542b4b', roughness: 0.3, metalness: 0.05, clearcoat: 0.22, clearcoatRoughness: 0.25 })
const hairHigh = new THREE.MeshPhysicalMaterial({ color: '#9c596f', roughness: 0.35, metalness: 0.04, clearcoat: 0.3 })
const white = new THREE.MeshStandardMaterial({ color: '#fff9f4', roughness: 0.43 })
const iris = new THREE.MeshPhysicalMaterial({ color: '#4b7895', roughness: 0.22, clearcoat: 0.45 })
const pupil = new THREE.MeshStandardMaterial({ color: '#211b2b', roughness: 0.35 })
const gold = new THREE.MeshPhysicalMaterial({ color: '#f5bc65', metalness: 0.72, roughness: 0.24, clearcoat: 0.25 })
const pearl = new THREE.MeshPhysicalMaterial({ color: '#fff0da', metalness: 0.08, roughness: 0.22, clearcoat: 0.45 })
const lipMaterial = new THREE.MeshPhysicalMaterial({ color: '#c96481', roughness: 0.27, clearcoat: 0.45, clearcoatRoughness: 0.16 })
const browMaterial = new THREE.MeshPhysicalMaterial({ color: '#4c293a', roughness: 0.48, clearcoat: 0.08 })
const lashMaterial = new THREE.MeshPhysicalMaterial({ color: '#291c2a', roughness: 0.42 })

function ellipsoid(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale: [number, number, number], parent = world) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  parent.add(mesh)
  return mesh
}

// Neck and shoulders give the head a complete portrait silhouette without competing with the paint surface.
ellipsoid(new THREE.CylinderGeometry(0.43, 0.48, 1.25, 32), warmSkin, [0, -1.12, -0.02], [1, 1, 0.96])
ellipsoid(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: '#8f5a91', roughness: 0.57 }), [0, -2.02, -0.14], [1.72, 0.53, 0.86])

// Eyes sit proud of the UV face. Their whites and irises retain a polished, dimensional look at mobile zoom.
for (const x of [-0.42, 0.42]) {
  ellipsoid(new THREE.SphereGeometry(1, 36, 24), white, [x, 0.82, 0.96], [0.285, 0.19, 0.105])
  ellipsoid(new THREE.SphereGeometry(1, 32, 20), iris, [x, 0.82, 1.07], [0.125, 0.125, 0.042])
  ellipsoid(new THREE.SphereGeometry(1, 28, 18), pupil, [x, 0.82, 1.115], [0.052, 0.058, 0.019])
  ellipsoid(new THREE.SphereGeometry(1, 16, 12), pearl, [x - 0.035, 0.865, 1.14], [0.021, 0.027, 0.008])

  const direction = Math.sign(x)
  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - direction * 0.27, 1.14, 1.0),
    new THREE.Vector3(x, 1.23, 1.08),
    new THREE.Vector3(x + direction * 0.25, 1.15, 1.0),
  ])
  world.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 18, 0.032, 8, false), browMaterial))

  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - direction * 0.24, 0.89, 1.12),
    new THREE.Vector3(x, 0.98, 1.17),
    new THREE.Vector3(x + direction * 0.23, 0.89, 1.12),
  ])
  world.add(new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 18, 0.018, 6, false), lashMaterial))
}

ellipsoid(new THREE.SphereGeometry(1, 32, 24), skinDetail, [0, 0.39, 1.055], [0.12, 0.2, 0.11])
ellipsoid(new THREE.SphereGeometry(1, 28, 18), lipMaterial, [-0.1, 0.03, 1.045], [0.19, 0.055, 0.045])
ellipsoid(new THREE.SphereGeometry(1, 28, 18), lipMaterial, [0.1, 0.03, 1.045], [0.19, 0.055, 0.045])
ellipsoid(new THREE.SphereGeometry(1, 20, 16), skinDetail, [-1.17, 0.55, 0], [0.11, 0.18, 0.06])
ellipsoid(new THREE.SphereGeometry(1, 20, 16), skinDetail, [1.17, 0.55, 0], [0.11, 0.18, 0.06])

// Voluminous hair is modelled as a back cap plus individually curved strands, so it holds up from any orbit angle.
ellipsoid(new THREE.SphereGeometry(1, 72, 48), darkHair, [0, 0.92, -0.18], [1.34, 1.53, 1.04])
for (let index = 0; index < 9; index += 1) {
  const t = index / 8
  const x = -1.02 + t * 2.04
  const side = Math.sign(x || 1)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x * 0.84, 1.84 - 0.13 * Math.abs(x), 0.51),
    new THREE.Vector3(x * 1.02, 1.43, 0.86),
    new THREE.Vector3(x * 0.83 + side * 0.11, 1.06 + (index % 2) * 0.06, 1.04),
  ])
  const strand = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.102 - Math.abs(index - 4) * 0.005, 10, false), index % 2 === 0 ? darkHair : hairHigh)
  world.add(strand)
}
for (const x of [-0.72, -0.36, 0, 0.36, 0.72]) {
  const curl = ellipsoid(new THREE.SphereGeometry(1, 32, 20), x === 0 ? hairHigh : darkHair, [x, 1.44 - Math.abs(x) * 0.17, 0.81], [0.34, 0.24, 0.15])
  curl.rotation.z = x * -0.33
}

// Tiara and gems provide the recognisable princess cue, while staying original to this model.
const tiara = new THREE.Group()
tiara.position.set(0, 1.72, 0.7)
world.add(tiara)
const crownCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.74, -0.04, 0), new THREE.Vector3(-0.38, 0.18, 0.06), new THREE.Vector3(0, 0.28, 0.08), new THREE.Vector3(0.38, 0.18, 0.06), new THREE.Vector3(0.74, -0.04, 0),
])
tiara.add(new THREE.Mesh(new THREE.TubeGeometry(crownCurve, 32, 0.035, 10, false), gold))
for (const [x, y, s] of [[-0.36, 0.17, 0.075], [0, 0.31, 0.11], [0.36, 0.17, 0.075]] as const) {
  ellipsoid(new THREE.OctahedronGeometry(1, 1), pearl, [x, y, 0.075], [s, s * 1.28, s], tiara)
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const targetCamera = new THREE.Vector3(0, 0.45, 7.1)
const targetLookAt = new THREE.Vector3(0, 0.42, 0)

function resize() {
  const rect = canvas.getBoundingClientRect()
  renderer.setSize(rect.width, rect.height, false)
  camera.aspect = rect.width / rect.height
  camera.updateProjectionMatrix()
}

function toolButton(tool: Tool, compact = false) {
  return `<button class="tool-button${tool.id === currentTool.id ? ' active' : ''}" type="button" data-tool="${tool.id}" aria-pressed="${tool.id === currentTool.id}">
    <i style="--swatch:${tool.color}"></i><span>${compact ? tool.eyebrow : tool.label}</span>${compact ? '' : `<small>${tool.eyebrow}</small>`}
  </button>`
}

function updateToolUI() {
  toolList.innerHTML = tools.map((tool) => toolButton(tool)).join('')
  mobileToolStrip.innerHTML = tools.map((tool) => toolButton(tool, true)).join('')
  finishTitle.textContent = currentTool.label
  mobileToolName.textContent = currentTool.label
  brushOutput.value = String(brushSize)
  brushInput.value = String(brushSize)
  opacityStatus.textContent = `${Math.round(currentTool.opacity * 100)}%`
  swatchRow.innerHTML = tools.map((tool) => `<button type="button" data-tool="${tool.id}" class="material-swatch${tool.id === currentTool.id ? ' selected' : ''}" style="--swatch:${tool.color}" aria-label="Use ${tool.label}"></button>`).join('')
}

function updateProgress() {
  const completed = [...coreTools].filter((id) => exploredTools.has(id)).length
  progressLabel.textContent = lookComplete ? 'Look complete' : `${completed} / 3 touches`
  lookProgress.classList.toggle('complete', lookComplete)
}

function completeLook() {
  if (lookComplete) return
  lookComplete = true
  updateProgress()
  window.setTimeout(() => {
    reveal.classList.add('visible')
    reveal.setAttribute('aria-hidden', 'false')
  }, 500)
}

function recordPaintedTool() {
  if (!coreTools.has(currentTool.id) || exploredTools.has(currentTool.id)) return
  exploredTools.add(currentTool.id)
  updateProgress()
  if (exploredTools.size === coreTools.size) completeLook()
}

function selectTool(id: ToolId) {
  const next = tools.find((tool) => tool.id === id)
  if (!next) return
  currentTool = next
  brushSize = next.size
  updateToolUI()
  if (paintLocked) showToast(`${next.label} ready`)
}

function showToast(message: string) {
  toast.textContent = message
  toast.classList.add('visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1400)
}

function saveUndo() {
  if (undoStack.length > 9) undoStack.shift()
  undoStack.push(paintContext.getImageData(0, 0, textureSize, textureSize))
  undoButton.disabled = false
  mobileUndo.disabled = false
}

function refreshTexture() {
  faceTexture.needsUpdate = true
  textureStatus.textContent = undoStack.length ? 'Edited' : 'Ready'
}

function clearTexture(pushUndo = true) {
  if (pushUndo) saveUndo()
  paintContext.putImageData(baseTexture, 0, 0)
  refreshTexture()
}

function resetLook() {
  undoStack = []
  undoButton.disabled = true
  mobileUndo.disabled = true
  clearTexture(false)
  exploredTools.clear()
  lookComplete = false
  updateProgress()
  reveal.classList.remove('visible')
  reveal.setAttribute('aria-hidden', 'true')
}

function undo() {
  const snapshot = undoStack.pop()
  if (!snapshot) return
  paintContext.putImageData(snapshot, 0, 0)
  undoButton.disabled = undoStack.length === 0
  mobileUndo.disabled = undoStack.length === 0
  refreshTexture()
  showToast('Last stroke undone')
}

function paintDot(uv: THREE.Vector2) {
  const { x, y } = canvasPoint(uv.x, uv.y)
  const radius = currentTool.id === 'freckles' ? Math.max(5, brushSize * 0.18) : brushSize
  const strength = currentTool.id === 'freckles' ? 0.76 : 1
  const bloom = paintContext.createRadialGradient(x, y, radius * 0.08, x, y, radius)
  bloom.addColorStop(0, `${currentTool.color}${Math.round(currentTool.opacity * 255 * strength).toString(16).padStart(2, '0')}`)
  bloom.addColorStop(0.52, `${currentTool.color}${Math.round(currentTool.opacity * 160 * strength).toString(16).padStart(2, '0')}`)
  bloom.addColorStop(1, `${currentTool.color}00`)
  paintContext.save()
  paintContext.globalCompositeOperation = currentTool.blend ?? 'source-over'
  paintContext.fillStyle = bloom
  paintContext.beginPath()
  paintContext.arc(x, y, radius, 0, Math.PI * 2)
  paintContext.fill()
  if (currentTool.id === 'freckles') {
    paintContext.fillStyle = `${currentTool.color}8f`
    for (let index = 0; index < 5; index += 1) {
      const angle = index * 2.39
      const distance = radius * (0.22 + (index % 3) * 0.13)
      paintContext.beginPath()
      paintContext.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 1.7 + (index % 2), 0, Math.PI * 2)
      paintContext.fill()
    }
  }
  paintContext.restore()
}

function isPaintable(uv: THREE.Vector2) {
  const uDistance = Math.abs(uv.x - faceU)
  const vDistance = Math.abs(uv.y - faceV)
  return uDistance < 0.19 && vDistance < 0.265
}

function paintAt(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObject(head, false)[0]
  if (!hit?.uv || !isPaintable(hit.uv)) return false
  const uv = hit.uv
  if (lastPaint) {
    const distance = lastPaint.distanceTo(uv)
    const spacing = Math.max(0.0028, brushSize / textureSize * 0.22)
    const steps = Math.ceil(distance / spacing)
    for (let index = 1; index <= steps; index += 1) paintDot(lastPaint.clone().lerp(uv, index / steps))
  } else paintDot(uv)
  lastPaint = uv.clone()
  recordPaintedTool()
  refreshTexture()
  return true
}

function setPaintLock(next: boolean, quiet = false) {
  paintLocked = next
  controls.enabled = !next
  lockButton.setAttribute('aria-pressed', String(next))
  lockButton.setAttribute('aria-label', next ? 'Unlock camera' : 'Lock camera for painting')
  document.querySelector('.studio-shell')!.classList.toggle('paint-locked', next)
  const compactControl = window.matchMedia('(max-width: 680px)').matches
  lockLabel.textContent = next ? (compactControl ? 'Unlock' : 'Unlock camera') : (compactControl ? 'Paint' : 'Lock to paint')
  modeReadout.innerHTML = next ? '<i></i><span>Paint mode active</span>' : '<i></i><span>Explore the face</span>'
  paintModeLabel.classList.toggle('visible', next)
  touchHint.classList.toggle('hidden', next)
  if (next) {
    targetCamera.set(0, 0.45, compactControl ? 7.1 : 6.15)
    targetLookAt.set(0, 0.42, 0)
    if (!quiet) showToast('Camera locked — paint the face')
  } else if (!quiet) showToast('Camera unlocked — explore freely')
}

function centerFront() {
  targetCamera.set(0, 0.45, paintLocked && window.innerWidth > 680 ? 6.15 : 7.1)
  targetLookAt.set(0, 0.42, 0)
  camera.position.copy(targetCamera)
  controls.target.copy(targetLookAt)
  controls.update()
  showToast('Front view centered')
}

function zoom(direction: number) {
  const toward = camera.position.clone().sub(controls.target).normalize()
  const distance = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) - direction * 0.55, controls.minDistance, controls.maxDistance)
  camera.position.copy(controls.target).add(toward.multiplyScalar(distance))
  targetCamera.copy(camera.position)
  controls.update()
}

canvas.addEventListener('pointerdown', (event) => {
  if (!paintLocked) return
  event.preventDefault()
  lastPaint = undefined
  // Snapshot before the first dab, so Undo restores the genuine pre-stroke texture.
  saveUndo()
  if (!paintAt(event)) {
    undoStack.pop()
    undoButton.disabled = undoStack.length === 0
    mobileUndo.disabled = undoStack.length === 0
    return
  }
  painting = true
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', (event) => {
  if (!paintLocked || !painting) return
  event.preventDefault()
  paintAt(event)
})
canvas.addEventListener('pointerup', () => { painting = false; lastPaint = undefined })
canvas.addEventListener('pointercancel', () => { painting = false; lastPaint = undefined })
canvas.addEventListener('pointermove', (event) => {
  if (!paintLocked) return
  paintIndicator.style.left = `${event.clientX}px`
  paintIndicator.style.top = `${event.clientY}px`
  paintIndicator.style.width = `${Math.max(24, brushSize * canvas.clientWidth / textureSize * 2)}px`
  paintIndicator.style.height = paintIndicator.style.width
  paintIndicator.classList.toggle('shown', !painting)
})
canvas.addEventListener('pointerleave', () => paintIndicator.classList.remove('shown'))

toolList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]')
  if (button) selectTool(button.dataset.tool as ToolId)
})
mobileToolStrip.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]')
  if (button) selectTool(button.dataset.tool as ToolId)
})
swatchRow.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]')
  if (button) selectTool(button.dataset.tool as ToolId)
})
brushInput.addEventListener('input', () => {
  brushSize = Number(brushInput.value)
  brushOutput.value = String(brushSize)
})
lockButton.addEventListener('click', () => setPaintLock(!paintLocked))
document.querySelector<HTMLButtonElement>('#front-view')!.addEventListener('click', centerFront)
document.querySelector<HTMLButtonElement>('#zoom-in')!.addEventListener('click', () => zoom(1))
document.querySelector<HTMLButtonElement>('#zoom-out')!.addEventListener('click', () => zoom(-1))
undoButton.addEventListener('click', undo)
mobileUndo.addEventListener('click', undo)
clearButton.addEventListener('click', () => { resetLook(); showToast('Face texture reset') })
mobileClear.addEventListener('click', () => { resetLook(); showToast('Face texture reset') })
document.querySelector<HTMLButtonElement>('#reset-button')!.addEventListener('click', () => { resetLook(); centerFront(); showToast('Fresh face ready') })
keepPainting.addEventListener('click', () => {
  reveal.classList.remove('visible')
  reveal.setAttribute('aria-hidden', 'true')
  showToast('Add your finishing touches')
})
saveLook.addEventListener('click', () => {
  const link = document.createElement('a')
  link.download = 'luma-princess-look.png'
  link.href = renderer.domElement.toDataURL('image/png')
  link.click()
  showToast('Look saved')
})

window.addEventListener('resize', resize)
resize()
updateToolUI()
updateProgress()

function render() {
  if (paintLocked) {
    camera.position.lerp(targetCamera, 0.12)
    controls.target.lerp(targetLookAt, 0.12)
    camera.lookAt(controls.target)
  } else controls.update()
  world.rotation.y = THREE.MathUtils.lerp(world.rotation.y, 0, 0.025)
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}

render()
