import { useEffect, useRef } from 'react'

// Liquid-glass material rendered in WebGL. Generates its own flowing color field from the
// song colors (the aurora is faded/occluded behind the player bar, so it can't be sampled),
// then refracts that field through a circular lens with chromatic edge dispersion, a Fresnel
// rim, and a pointer-tracked specular highlight. Press squishes the lens.
//
// Renders an absolute round canvas filling the parent button; the play/pause icon stays a DOM
// element layered above. Pointer/press are read from the parent button's events.

interface GlassButtonGLProps {
  size: number                       // css px (button diameter)
  color1: [number, number, number]   // linear rgb
  color2: [number, number, number]   // linear rgb
  onFail?: () => void                // WebGL unavailable -> parent uses CSS fallback
}

const VS = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec2  uPointer;   // 0..1, specular light position
uniform float uPress;     // 0..1

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = rot * p * 2.0; a *= 0.5; }
  return v;
}

// Self-generated flowing aurora field behind the glass.
vec3 field(vec2 c) {
  float n  = fbm(c * 3.0 + vec2(uTime * 0.22, uTime * 0.16));
  float n2 = fbm(c * 5.5 - vec2(uTime * 0.13, uTime * 0.21));
  float m  = clamp(n * 0.75 + n2 * 0.45, 0.0, 1.0);
  vec3 col = mix(uColor1, uColor2, m);
  col += vec3(0.14) * smoothstep(0.62, 1.0, n);   // light streaks
  return col * 1.22;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p  = (uv - 0.5) * 2.0;
  float d = length(p);
  float R = 0.92;
  float inside = 1.0 - smoothstep(R - 0.05, R, d);
  if (inside <= 0.001) { gl_FragColor = vec4(0.0); return; }

  // Hemispherical lens normal; press flattens the dome.
  float z = sqrt(max(0.0, 1.0 - (d / R) * (d / R)));
  vec3 normal = normalize(vec3(p / R, z * (1.0 - 0.35 * uPress) + 0.0001));

  // Refraction: sample the field at lens-displaced coords, split per channel for dispersion.
  float lensPower = 0.16 + 0.10 * uPress;
  vec2 uvR = uv + normal.xy * (lensPower * 1.05);
  vec2 uvG = uv + normal.xy * (lensPower * 1.00);
  vec2 uvB = uv + normal.xy * (lensPower * 0.95);
  vec3 col = vec3(field(uvR).r, field(uvG).g, field(uvB).b);

  // Fresnel refractive rim.
  float fres = pow(1.0 - z, 3.0);
  col += vec3(0.70, 0.85, 1.0) * fres * 0.55;

  // Pointer-tracked specular glint.
  vec3 ldir = normalize(vec3(uPointer - uv, 0.55));
  float spec = pow(max(dot(normal, ldir), 0.0), 38.0);
  col += vec3(1.0) * spec * 0.85;

  // Localized center dim for DOM-icon legibility on bright frames.
  col *= mix(0.80, 1.0, smoothstep(0.0, 0.55, d));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), inside);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[GlassButtonGL] shader compile:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function GlassButtonGL({ size, color1, color2, onFail }: GlassButtonGLProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef<[number, number]>([0.5, 0.28])
  const pressRef = useRef(0)
  const pressTargetRef = useRef(0)

  // Live color refs — updated each render, read inside the RAF without restarting it.
  const color1Ref = useRef(color1)
  const color2Ref = useRef(color2)
  color1Ref.current = color1
  color2Ref.current = color2

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true })
    if (!gl) { onFail?.(); return }

    const vs = compile(gl, gl.VERTEX_SHADER, VS)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS)
    const prog = gl.createProgram()
    if (!vs || !fs || !prog) { onFail?.(); return }
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[GlassButtonGL] link:', gl.getProgramInfoLog(prog))
      onFail?.()
      return
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'aPosition')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    gl.deleteShader(vs)
    gl.deleteShader(fs)
    gl.useProgram(prog)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uRes = gl.getUniformLocation(prog, 'uResolution')
    const uC1 = gl.getUniformLocation(prog, 'uColor1')
    const uC2 = gl.getUniformLocation(prog, 'uColor2')
    const uPtr = gl.getUniformLocation(prog, 'uPointer')
    const uPress = gl.getUniformLocation(prog, 'uPress')

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0

    // Non-null bindings for the RAF closure (TS drops narrowing across fn boundaries).
    const g = gl
    const cv = canvas

    function frame() {
      const now = performance.now()
      const t = (now - start) / 1000
      pressRef.current += (pressTargetRef.current - pressRef.current) * 0.2

      g.uniform1f(uTime, t)
      g.uniform2f(uRes, cv.width, cv.height)
      g.uniform3fv(uC1, color1Ref.current)
      g.uniform3fv(uC2, color2Ref.current)
      g.uniform2f(uPtr, pointerRef.current[0], pointerRef.current[1])
      g.uniform1f(uPress, pressRef.current)
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4)

      if (!reduced) raf = requestAnimationFrame(frame)
    }

    // Pointer + press read from the parent button.
    const parent = canvas.parentElement
    const onMove = (e: PointerEvent) => {
      const r = (parent as HTMLElement).getBoundingClientRect()
      pointerRef.current = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
    }
    const onLeave = () => { pointerRef.current = [0.5, 0.28] }
    const onDown = () => { pressTargetRef.current = 1 }
    const onUp = () => { pressTargetRef.current = 0 }
    parent?.addEventListener('pointermove', onMove)
    parent?.addEventListener('pointerleave', onLeave)
    parent?.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    frame()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      parent?.removeEventListener('pointermove', onMove)
      parent?.removeEventListener('pointerleave', onLeave)
      parent?.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
    // size is fixed per variant; colors flow through refs. onFail is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: '999px',
        pointerEvents: 'none',
      }}
    />
  )
}
