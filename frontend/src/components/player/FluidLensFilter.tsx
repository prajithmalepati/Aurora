// Hidden SVG lens filter used by the glass play buttons via `backdrop-filter: url(#fluid-lens)`.
// It displaces the element's BACKDROP (the real pixels behind it — the moving aurora behind a
// row button, etc.) using an R/G gradient map, producing a convex-lens magnify + distortion of
// whatever is actually behind the button. Real lensing in Chromium; Firefox/Safari ignore the
// url() filter and fall back to the plain blur/saturate in the CSS (graceful frost).

// Displacement map: red = horizontal offset, green = vertical offset. Each channel runs a smooth
// gradient so the center is neutral (~0.5) and the edges pull inward → barrel magnification.
const LENS_MAP = `
<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>
  <defs>
    <linearGradient id='rx' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='rgb(255,0,0)'/>
      <stop offset='1' stop-color='rgb(0,0,0)'/>
    </linearGradient>
    <linearGradient id='gy' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='rgb(0,255,0)'/>
      <stop offset='1' stop-color='rgb(0,0,0)'/>
    </linearGradient>
  </defs>
  <rect width='100' height='100' fill='rgb(0,0,0)'/>
  <rect width='100' height='100' fill='url(#rx)' style='mix-blend-mode:screen'/>
  <rect width='100' height='100' fill='url(#gy)' style='mix-blend-mode:screen'/>
</svg>`

const MAP_HREF = `data:image/svg+xml;utf8,${encodeURIComponent(LENS_MAP)}`

export function FluidLensFilter() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter
          id="fluid-lens"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={MAP_HREF}
            result="map"
            preserveAspectRatio="none"
            x="0"
            y="0"
            width="100%"
            height="100%"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
