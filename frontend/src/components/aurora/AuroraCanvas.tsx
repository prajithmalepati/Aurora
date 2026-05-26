import { useEffect, useRef, useCallback, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { oklchToLinearRgb, BRAND_TEAL_LINEAR, DEFAULT_COLOR } from '@/hooks/useAuroraColor'

interface AuroraCanvasProps {
  amplitude: number  // 0–1 transient-sensitive
  intensity: number  // 0–1 view-driven
}

// Vertex shader — fullscreen quad
const VS = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

// Fragment shader — fBm noise, OKLab color mixing, altitude tinting, 4 curtains
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

uniform float uTime;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform float uAmplitude;
uniform float uIntensity;
uniform vec2  uResolution;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = rot * p * 2.0; a *= 0.5; }
  return v;
}

vec3 oklab_mix(vec3 lin1, vec3 lin2, float a) {
  const mat3 kCONEtoLMS = mat3(0.4122,0.2119,0.0883,0.5363,0.6807,0.2818,0.0515,0.1074,0.6303);
  const mat3 kLMStoCONE = mat3(4.0767,-1.2681,-0.0041,-3.3072,2.6093,-0.7035,0.2308,-0.3411,1.7069);
  vec3 lms1 = pow(kCONEtoLMS * lin1, vec3(1.0/3.0));
  vec3 lms2 = pow(kCONEtoLMS * lin2, vec3(1.0/3.0));
  vec3 lms  = mix(lms1, lms2, a);
  lms *= 1.0 + 0.2 * a * (1.0 - a);
  return kLMStoCONE * (lms * lms * lms);
}

float curtain(vec2 uv, float t, float phase, float speed, float freq) {
  float wave  = sin(uv.x * freq + t * speed + phase) * 0.14;
  wave       += sin(uv.x * freq * 1.73 + t * speed * 0.61 + phase * 1.41) * 0.07;
  wave       += fbm(vec2(uv.x * 2.2, t * 0.12 + phase)) * 0.10;
  float cy    = 0.48 + wave + sin(t * 0.05 + phase) * 0.05;
  float dist  = abs(uv.y - cy);
  float coreW = 0.05 + sin(t * 0.04 + phase * 0.7) * 0.012;
  float core  = smoothstep(coreW, 0.0, dist);
  float glow  = smoothstep(coreW * 5.0, coreW, dist) * 0.22;
  return core + glow;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime;

  float a = 0.0;
  a += curtain(uv, t, 0.00, 0.31, 2.10) * 0.50;
  a += curtain(uv, t, 1.70, 0.19, 3.30) * 0.40;
  a += curtain(uv, t, 3.14, 0.23, 1.80) * 0.35;
  a += curtain(uv, t, 5.30, 0.17, 4.10) * 0.30;

  a *= 1.0 + uAmplitude * 0.5;
  a  = clamp(a, 0.0, 1.0);

  float colorT = uv.y * 0.6 + sin(t * 0.08) * 0.1 + 0.2;
  vec3  color  = oklab_mix(uColor1, uColor2, clamp(colorT, 0.0, 1.0));

  vec3 greenCore  = vec3(0.05, 0.75, 0.25);
  vec3 redFringe  = vec3(0.85, 0.15, 0.10);
  color = mix(color, mix(greenCore, redFringe, smoothstep(0.45, 0.75, uv.y)), 0.35);

  color = mix(color, vec3(0.95, 0.98, 1.0), a * a * 0.30);

  float alpha = a * uIntensity * 0.60;
  alpha *= smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.75, uv.y);

  gl_FragColor = vec4(color, alpha);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[AuroraCanvas] shader compile:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function initWebGL(canvas: HTMLCanvasElement): {
  gl: WebGLRenderingContext
  uniforms: Record<string, WebGLUniformLocation>
} | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
  if (!gl) return null

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS)
  if (!vs || !fs) return null

  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[AuroraCanvas] link:', gl.getProgramInfoLog(prog))
    return null
  }

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

  const pos = gl.getAttribLocation(prog, 'aPosition')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

  // Free GPU memory — shaders no longer needed after linking
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  gl.useProgram(prog)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)  // additive: glow/light emission
  gl.blendEquation(gl.FUNC_ADD)

  const uniforms: Record<string, WebGLUniformLocation> = {}
  for (const name of ['uTime','uColor1','uColor2','uAmplitude','uIntensity','uResolution']) {
    const loc = gl.getUniformLocation(prog, name)
    if (loc) uniforms[name] = loc
  }

  return { gl, uniforms }
}

export function AuroraCanvas({ amplitude, intensity }: AuroraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<{ gl: WebGLRenderingContext; uniforms: Record<string, WebGLUniformLocation> } | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(performance.now())
  const [webglFailed, setWebglFailed] = useState(false)

  const currentSong = usePlayerStore(s => s.currentSong)
  const color2 = oklchToLinearRgb(currentSong?.dominant_color_2 ?? DEFAULT_COLOR)

  // Lerped color2 (300ms)
  const currentColor2Ref = useRef<[number, number, number]>([...color2])
  const targetColor2Ref  = useRef<[number, number, number]>([...color2])
  const color2StartRef   = useRef<number>(0)
  const color2PrevRef    = useRef<[number, number, number]>([...color2])

  // Lerped intensity (600ms)
  const currentIntensityRef = useRef(intensity)
  const targetIntensityRef  = useRef(intensity)
  const intensityStartRef   = useRef<number>(0)
  const intensityPrevRef    = useRef(intensity)

  const amplitudeRef = useRef(amplitude)
  amplitudeRef.current = amplitude

  const color1Ref = useRef<[number, number, number]>(BRAND_TEAL_LINEAR)

  useEffect(() => {
    targetColor2Ref.current = color2
    color2StartRef.current = performance.now()
    color2PrevRef.current = [...currentColor2Ref.current]
  }, [color2[0], color2[1], color2[2]])

  useEffect(() => {
    targetIntensityRef.current = intensity
    intensityStartRef.current = performance.now()
    intensityPrevRef.current = currentIntensityRef.current
  }, [intensity])

  const draw = useCallback(() => {
    const ctx = glRef.current
    if (!ctx) return
    const { gl, uniforms } = ctx
    const canvas = canvasRef.current
    if (!canvas) return

    const now = performance.now()
    const t = ((now - startRef.current) / 1000) % 1000

    // Lerp color2 (300ms)
    const ct = Math.min(1, (now - color2StartRef.current) / 300)
    const ce = ct < 1 ? ct * ct * (3 - 2 * ct) : 1
    currentColor2Ref.current = [
      color2PrevRef.current[0] + (targetColor2Ref.current[0] - color2PrevRef.current[0]) * ce,
      color2PrevRef.current[1] + (targetColor2Ref.current[1] - color2PrevRef.current[1]) * ce,
      color2PrevRef.current[2] + (targetColor2Ref.current[2] - color2PrevRef.current[2]) * ce,
    ]

    // Lerp intensity (600ms)
    const it = Math.min(1, (now - intensityStartRef.current) / 600)
    const ie = it < 1 ? it * it * (3 - 2 * it) : 1
    currentIntensityRef.current =
      intensityPrevRef.current + (targetIntensityRef.current - intensityPrevRef.current) * ie

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (uniforms.uTime)       gl.uniform1f(uniforms.uTime, t)
    if (uniforms.uResolution) gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height)
    if (uniforms.uColor1)     gl.uniform3fv(uniforms.uColor1, color1Ref.current)
    if (uniforms.uColor2)     gl.uniform3fv(uniforms.uColor2, currentColor2Ref.current)
    if (uniforms.uAmplitude)  gl.uniform1f(uniforms.uAmplitude, amplitudeRef.current)
    if (uniforms.uIntensity)  gl.uniform1f(uniforms.uIntensity, currentIntensityRef.current)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    rafRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const result = initWebGL(canvas)
    if (!result) {
      console.warn('[AuroraCanvas] WebGL init failed — using CSS fallback')
      setWebglFailed(true)
      return
    }
    glRef.current = result
    rafRef.current = requestAnimationFrame(draw)

    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    const onContextLost = (e: Event) => {
      e.preventDefault()
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      glRef.current = null
      fallbackTimer = setTimeout(() => {
        if (!glRef.current) setWebglFailed(true)
      }, 5000)
    }
    const onContextRestored = () => {
      clearTimeout(fallbackTimer)
      const r = initWebGL(canvas)
      if (r) { glRef.current = r; rafRef.current = requestAnimationFrame(draw) }
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    return () => {
      clearTimeout(fallbackTimer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [draw])

  // Resize handler — DPR capped at 1.5
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    })
    ro.observe(canvas)
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    return () => ro.disconnect()
  }, [])

  if (webglFailed) return <div className="aurora-fallback" aria-hidden />

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  )
}
