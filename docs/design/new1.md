1. ok i was just on Aurora listening to songs then i got this really cool idea. i want to rehaul our entire play button, how the light bleed on song covers, playlist cover bleed intensity is good right now but we can change a bit of it too. so entirely what i am saying is. 
1) for our play button instead of frosted flass , lets go for a liquid glass but lets keep like a bright star you see in a Aurora Borealis and it would probably look beautiful through the liquid glass. then lets make it interactible with the mouse like every time you touch it kinda wavers starting from that initial contact direcion or maybe it just wavers, then if you just hold on it for like some fixed amount of time or just for fun's sake we can make this variable based on the song length( but if it is too much we can remove this) it slowly glows better . think on this , use your skills, get new skills or more research if needed. let me know if you need help from my end.
2) so for our bleed, lets find a way to get our most dominant colour or most appeared color on that image and then bleed that colour. and instead of keeping the light source behind the song cover lets make the light source a lot bigger and keep it more far so that entire side of the olayer bar is kinda that colour even iin the dark. we have to understand this is still Aurora A dark App. but we can add the bleed on song playing too ont he screen like current playing song has a light bleed from behind its song cover. also please change How the Word Aurora looks on the screen. I dont know if its that font or something i dont like  how it looks

we need a big overhaul with newer skills on how aurora look. i can use nano banana or something to get a video based on your feedback if we needed. we need anti slop. make a comprehensive design on how everything looks. look at the latest data online. just cause all music players are common and boring doesnt mean ours have to be like this too.

You tend to converge toward generic, "on distribution" outputs.
In frontend design, this creates what users call the "AI slop" aesthetic.
Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:
- Typography: Avoid generic fonts like Arial, Inter, Roboto, Open Sans, Lato.
  Opt for distinctive choices that elevate the frontend.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency.
  Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only.
  Use Motion library for React when available. Focus on high-impact moments.
- Backgrounds: Create atmosphere and depth. Avoid defaulting to solid colors.

Avoid: overused fonts (Inter, Roboto, Arial), purple gradients on white,
predictable layouts, Space Grotesk as a "distinctive" default.
</frontend_aesthetics>

we need a way for you test things too like playwright? i heard something like that.

currently i dont have other subscriptions like glm or deepseek or any other paying ones. but i will integrate them later

document everything like andrej karpathy or boris cherny. maybe get a prompt improver too if you think we need it

asked gemini 3.1 pro to do some research and it gave me these looks outs

1. Technical Watch-Outs & Gotchas

    CSS Grid Height Animation Bug: While transitioning grid-template-rows from 0fr to 1fr is the best modern way to animate height, it has a known quirk. You must explicitly define an align-items property (like align-items: start) on the grid container. If you leave it at the default (none), the dynamic fr unit struggles to calculate the children's size, resulting in jagged jumps or delayed transitions.

    Lenis + GSAP Rendering Lag: Running Lenis smooth scrolling and GSAP ScrollTrigger on their own animation loops causes a noticeable 1-to-2 frame rendering lag. You must pass autoRaf: false to the Lenis setup to disable its native loop, and explicitly bind its .raf() update method to the gsap.ticker (multiplying GSAP's time in seconds by 1000 to match Lenis's milliseconds).  

    Audio Decoding Freezes: Your spec uses AudioContext.decodeAudioData to pre-compute the SVG waveform. This is highly performant for playback, but be aware that the decoding process blocks, has no progress callback, and cannot be canceled. If a user loads a massive 2-hour audio file, it will silently consume heavy resources until finished. Always include a visual loading state during this step.

    some improvements

    Motion Restraint: Do not add scattered, arbitrary hover micro-animations. Instead, orchestrate a single, highly polished page-load sequence using staggered CSS animation-delay properties. All UI animations must strictly modify transform and opacity only. Never animate width, height, margin, or padding.  

Atmospheric Depth: Completely avoid solid white or flat dark backgrounds. Always utilize layered CSS gradients, SVG grain/noise overlays, and OKLCH color-mixing to create deep, atmospheric spatial layers.  

Accessibility Override: You must implement window.matchMedia("(prefers-reduced-motion: reduce)").matches across the application. If true, instantly kill all GLSL shader animations, freeze the waveform, and force Lenis scroll interpolation to 1 (instant)

