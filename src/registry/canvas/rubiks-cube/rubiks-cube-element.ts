import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Box, Camera, Mat4, Mesh, Orbit, Program, Quat, Renderer, Transform, Vec3 } from "ogl"
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color"

type Move = {
  axis: "x" | "y" | "z"
  layer: -1 | 0 | 1
  direction: 1 | -1
  rotationAngle?: number
}

type CubeState = {
  id: string
  position: Vec3
  quaternion: Quat
  mesh: Mesh
}

const POSSIBLE_MOVES: Move[] = (() => {
  const moves: Move[] = []
  for (const axis of ["x", "y", "z"] as const) {
    for (const layer of [-1, 0, 1] as const) {
      for (const direction of [1, -1] as const) {
        moves.push({ axis, layer, direction })
      }
    }
  }
  return moves
})()

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const CUBELET_SIZE = 1
const CAMERA_FOV = 32
const CAMERA_DISTANCE = 18.2

const createRoundedBoxGeometry = (gl: Renderer["gl"], cubeSize: number, cubeRadius: number) => {
  const segments = 20
  const geometry = new Box(gl, {
    width: cubeSize,
    height: cubeSize,
    depth: cubeSize,
    widthSegments: segments,
    heightSegments: segments,
    depthSegments: segments,
  })

  const positionAttr = geometry.attributes.position
  const normalAttr = geometry.attributes.normal
  const positions = positionAttr.data as Float32Array
  const normals = normalAttr.data as Float32Array

  const half = cubeSize * 0.5
  const rounded = Math.max(0, Math.min(cubeRadius, half))
  const inner = Math.max(0, half - rounded)

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]

    const sx = x < 0 ? -1 : 1
    const sy = y < 0 ? -1 : 1
    const sz = z < 0 ? -1 : 1

    const ax = Math.abs(x)
    const ay = Math.abs(y)
    const az = Math.abs(z)

    const qx = Math.max(ax - inner, 0)
    const qy = Math.max(ay - inner, 0)
    const qz = Math.max(az - inner, 0)
    const qLen = Math.hypot(qx, qy, qz)

    let nx = 0, ny = 0, nz = 0

    if (qLen > 1e-6) {
      nx = qx / qLen
      ny = qy / qLen
      nz = qz / qLen
    } else {
      if (ax >= ay && ax >= az) nx = 1
      else if (ay >= ax && ay >= az) ny = 1
      else nz = 1
    }

    normals[i] = nx * sx
    normals[i + 1] = ny * sy
    normals[i + 2] = nz * sz

    positions[i] = sx * inner + nx * sx * rounded
    positions[i + 1] = sy * inner + ny * sy * rounded
    positions[i + 2] = sz * inner + nz * sz * rounded
  }

  positionAttr.needsUpdate = true
  normalAttr.needsUpdate = true
  return geometry
}

const VERTEX = `
  precision highp float;

  attribute vec3 position;
  attribute vec3 normal;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT = `
  precision highp float;

  uniform vec3 color;
  uniform vec3 rimColor;
  uniform float rimPower;
  uniform float rimIntensity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  vec3 linearToSrgb(vec3 c) {
    vec3 safe = max(c, vec3(0.0));
    vec3 low = safe * 12.92;
    vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
    vec3 cutoff = step(vec3(0.0031308), safe);
    return mix(low, high, cutoff);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewPosition);
    float rim = 1.0 - max(0.0, dot(n, v));
    rim = pow(rim, rimPower) * rimIntensity;
    vec3 finalColor = color + rimColor * rim;
    gl_FragColor = vec4(linearToSrgb(finalColor), 1.0);
  }
`

@customElement("motion-rubiks-cube")
export class MotionRubiksCube extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: Number }) scale = 1
  @property({ type: Number, attribute: "offset-x" }) offsetX = 0
  @property({ type: Number, attribute: "offset-y" }) offsetY = 0
  @property({ type: Number }) rotation = 0
  @property({ type: Number }) duration = 1.5
  @property({ type: Number }) gap = 0.015
  @property({ type: Number }) radius = 0.125
  @property({ type: String }) color: ColorRepresentation = "#17181A"
  @property({ type: String, attribute: "rim-color" }) rimColor: ColorRepresentation = "#FF6900"
  @property({ type: Number, attribute: "rim-power" }) rimPower = 6
  @property({ type: Number, attribute: "rim-intensity" }) rimIntensity = 1.5

  private _raf = 0
  private _cancelled = false
  private _cleanup?: () => void
  private _applyUniforms?: () => void
  private _applyDimensions?: () => void
  private _applySceneTransform?: () => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._cleanup?.()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("color") || changed.has("rimColor") || changed.has("rimPower") || changed.has("rimIntensity")) {
      this._applyUniforms?.()
    }
    if (changed.has("gap") || changed.has("radius")) {
      this._applyDimensions?.()
    }
    if (changed.has("scale") || changed.has("offsetX") || changed.has("offsetY") || changed.has("rotation")) {
      this._applySceneTransform?.()
    }
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._cleanup?.()
    this._cleanup = undefined
    this._applyUniforms = undefined
    this._applyDimensions = undefined
    this._applySceneTransform = undefined
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false

    const renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl, { fov: CAMERA_FOV, aspect: 1, near: 0.1, far: 100 })
    camera.position.set(0, 0, CAMERA_DISTANCE)

    const scene = new Transform()
    const transformGroup = new Transform()
    transformGroup.setParent(scene)
    const mainGroup = new Transform()
    mainGroup.setParent(transformGroup)
    const layerGroup = new Transform()
    layerGroup.setParent(mainGroup)

    const orbit = new Orbit(camera, {
      element: canvas,
      enableZoom: false,
      target: new Vec3(0, 0, 0),
      ease: 0.15,
      inertia: 0.85,
    })

    const cubeGapRef = { value: this.gap }
    let cubeRadius = this.radius
    let geometry = createRoundedBoxGeometry(gl, CUBELET_SIZE, cubeRadius)

    const uniforms = {
      color: { value: new Vec3(17 / 255, 17 / 255, 19 / 255) },
      rimColor: { value: new Vec3(1, 105 / 255, 0) },
      rimPower: { value: 6 },
      rimIntensity: { value: 1.5 },
    }

    const material = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms,
      transparent: false,
      depthTest: true,
      depthWrite: true,
    })

    const cubes: CubeState[] = []
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        for (const z of [-1, 0, 1]) {
          const mesh = new Mesh(gl, { geometry, program: material, frustumCulled: false })
          mesh.setParent(mainGroup)
          cubes.push({
            id: `${x},${y},${z}`,
            position: new Vec3(x, y, z),
            quaternion: new Quat(),
            mesh,
          })
        }
      }
    }

    const updateCubeTransform = (cube: CubeState) => {
      const spacing = CUBELET_SIZE + cubeGapRef.value
      cube.mesh.position.set(
        cube.position.x * spacing,
        cube.position.y * spacing,
        cube.position.z * spacing,
      )
      cube.mesh.quaternion.copy(cube.quaternion)
    }

    for (let i = 0; i < cubes.length; i++) updateCubeTransform(cubes[i])

    let activeLayerSet = new Set<string>()
    let currentMove: Move | null = null
    let isAnimating = false
    let currentRotationProgress = 0
    let lastMoveAxis: Move["axis"] | null = null
    let timeSinceLastMove = 0

    const rotationMatrix = new Mat4()
    const tempQuat = new Quat()
    const deltaQuat = new Quat()
    const axisVec = new Vec3()

    const makeRotationMatrix = (axis: Move["axis"], angle: number) => {
      axisVec.set(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0)
      tempQuat.fromAxisAngle(axisVec, angle)
      rotationMatrix.identity().fromQuaternion(tempQuat)
      return rotationMatrix
    }

    const resetLayerGrouping = () => {
      for (let i = 0; i < cubes.length; i++) cubes[i].mesh.setParent(mainGroup)
      activeLayerSet = new Set()
      layerGroup.rotation.set(0, 0, 0)
    }

    const selectActiveLayer = (move: Move) => {
      activeLayerSet = new Set()
      for (let i = 0; i < cubes.length; i++) {
        const cube = cubes[i]
        if (Math.round(cube.position[move.axis]) === move.layer) {
          activeLayerSet.add(cube.id)
          cube.mesh.setParent(layerGroup)
        } else {
          cube.mesh.setParent(mainGroup)
        }
      }
      layerGroup.rotation.set(0, 0, 0)
    }

    const commitMove = () => {
      if (!currentMove) return
      const move = currentMove
      const angle = (move.rotationAngle ?? Math.PI / 2) * move.direction
      const matrix = makeRotationMatrix(move.axis, angle)
      axisVec.set(move.axis === "x" ? 1 : 0, move.axis === "y" ? 1 : 0, move.axis === "z" ? 1 : 0)
      deltaQuat.fromAxisAngle(axisVec, angle)

      for (let i = 0; i < cubes.length; i++) {
        const cube = cubes[i]
        if (!activeLayerSet.has(cube.id)) continue
        cube.position.applyMatrix4(matrix)
        cube.position.set(
          Math.round(cube.position.x),
          Math.round(cube.position.y),
          Math.round(cube.position.z),
        )
        tempQuat.multiply(deltaQuat, cube.quaternion)
        cube.quaternion.copy(tempQuat).normalize()
        updateCubeTransform(cube)
      }

      resetLayerGrouping()
      isAnimating = false
      currentRotationProgress = 0
      currentMove = null
      timeSinceLastMove = 0
    }

    const beginMove = (move: Move) => {
      if (isAnimating) return
      currentMove = { ...move, rotationAngle: Math.PI / 2 }
      selectActiveLayer(currentMove)
      isAnimating = true
      currentRotationProgress = 0
      lastMoveAxis = move.axis
    }

    const selectNextMove = () => {
      const moves = POSSIBLE_MOVES.filter((m) => m.axis !== lastMoveAxis)
      beginMove(moves[Math.floor(Math.random() * moves.length)])
    }

    this._applyUniforms = () => {
      const [cr, cg, cb] = toLinearRgb(this.color, [17 / 255, 17 / 255, 19 / 255])
      const [rr, rg, rb] = toLinearRgb(this.rimColor, [1, 105 / 255, 0])
      uniforms.color.value.set(cr, cg, cb)
      uniforms.rimColor.value.set(rr, rg, rb)
      uniforms.rimPower.value = this.rimPower
      uniforms.rimIntensity.value = this.rimIntensity
    }
    this._applyUniforms()

    let width = 1
    let height = 1

    this._applySceneTransform = () => {
      const nextScale = Math.max(0.001, this.scale)
      const aspect = width / Math.max(1, height)
      const visibleHeight = 2 * CAMERA_DISTANCE * Math.tan((CAMERA_FOV * Math.PI) / 360)
      const visibleWidth = visibleHeight * aspect
      transformGroup.scale.set(nextScale, nextScale, nextScale)
      transformGroup.position.set(this.offsetX * visibleWidth, this.offsetY * visibleHeight, 0)
      transformGroup.rotation.z = (this.rotation * Math.PI) / 180
    }
    this._applySceneTransform()

    this._applyDimensions = () => {
      const nextGap = Math.max(0, this.gap)
      const nextRadius = Math.max(0, this.radius)
      const shouldRebuild = Math.abs(nextRadius - cubeRadius) > 1e-6

      cubeGapRef.value = nextGap
      cubeRadius = nextRadius

      if (shouldRebuild) {
        const prev = geometry
        geometry = createRoundedBoxGeometry(gl, CUBELET_SIZE, cubeRadius)
        for (let i = 0; i < cubes.length; i++) cubes[i].mesh.geometry = geometry
        prev.remove()
      }

      for (let i = 0; i < cubes.length; i++) updateCubeTransform(cubes[i])
    }

    let previous = 0
    const tick = (now: number) => {
      if (this._cancelled) return

      const w = Math.max(1, canvas.clientWidth)
      const h = Math.max(1, canvas.clientHeight)
      const bufW = Math.round(w * renderer.dpr)
      const bufH = Math.round(h * renderer.dpr)
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW
        canvas.height = bufH
        renderer.width = w
        renderer.height = h
        ;(renderer.state as any).viewport = { x: 0, y: 0, width: null, height: null }
        width = w
        height = h
        camera.perspective({ fov: CAMERA_FOV, aspect: w / Math.max(1, h), near: 0.1, far: 100 })
        this._applySceneTransform?.()
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now

      mainGroup.rotation.x += delta * 0.3
      mainGroup.rotation.y += delta * 0.5
      mainGroup.rotation.z += delta * 0.2

      orbit.update()

      if (isAnimating && currentMove) {
        const progressInc = delta / Math.max(0.0001, this.duration)
        currentRotationProgress = Math.min(currentRotationProgress + progressInc, 1)
        const eased = easeInOutCubic(currentRotationProgress)
        const angle = eased * (currentMove.rotationAngle ?? Math.PI / 2) * currentMove.direction

        if (currentMove.axis === "x") layerGroup.rotation.x = angle
        else if (currentMove.axis === "y") layerGroup.rotation.y = angle
        else layerGroup.rotation.z = angle

        if (currentRotationProgress >= 1) commitMove()
      } else {
        timeSinceLastMove += delta
        if (timeSinceLastMove > 0.4) selectNextMove()
      }

      renderer.render({ scene, camera, clear: true })
      this._raf = requestAnimationFrame(tick)
    }

    this._raf = requestAnimationFrame(tick)

    this._cleanup = () => {
      orbit.remove()
      material.remove()
      geometry.remove()
    }
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-rubiks-cube": MotionRubiksCube
  }
}
