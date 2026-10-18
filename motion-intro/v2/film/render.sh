#!/bin/bash
# Film v2 render helper.
#   render.sh bundle                         -> pre-bundle into build/ (fast renders afterwards)
#   render.sh still <9x16|16x9> <frame> [out.png] [debug]
#   render.sh stills <9x16|16x9> <tag> f1 f2 ...   -> out/qa/<tag>_<layout>_f<frame>.png
#   render.sh film <9x16|16x9> [out.mp4]     -> full 900-frame render (h264, crf 18)
#   render.sh perf <9x16|16x9> <from> <to>   -> timed range render (ms/frame)
#   render.sh events                         -> regenerate events.json from src/events.ts
#   render.sh wallcheck                      -> back-wall guard: corner clip w + coverage for every frame of both layouts
#   render.sh collide [from to]              -> collision guard: parts vs parts/plinth/plate on the snap + F1 lost leads vs parts
#   render.sh cues                           -> regenerate sfx-cues.json (screen x/y of every sound source, both layouts)
#   render.sh sfx                            -> events + cues -> public/audio/sfx.wav + out/sfx_timeline.png (PY=<python with numpy/scipy/soundfile/pedalboard/matplotlib>)
# env: CONC=<n> render concurrency (SwiftShader is already multi-threaded; 1-2 is best)
#      Q=fxaa,noaa  cheaper anti-aliasing path (~15% faster, slightly softer edges); Q is a perf/QA switch only
set -e
cd "$(dirname "$0")"
BROWSER="--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell --gl=swiftshader"
comp() { [ "$1" = "16x9" ] && echo "Film-16x9" || echo "Film-9x16"; }
prep() {
  # derived end-card layers (clean edge, rim, grade, shadow); regenerated whenever portrait.png changes
  if [ -f public/img/portrait.png ] && { [ ! -f public/img/portrait_rim.png ] || [ public/img/portrait.png -nt public/img/portrait_rim.png ]; }; then
    python3 scripts/portrait_prep.py public/img/portrait.png >/dev/null && echo "portrait layers rebuilt"
  fi
}
bundle() { prep; npx remotion bundle src/index.ts --out-dir build --log=error >/dev/null; echo "bundled"; }
case "$1" in
  bundle) bundle ;;
  still)
    [ -d build ] || bundle
    P='{"layout":"'$2'","debug":'${5:-false}',"q":"'${Q:-}'"}'
    npx remotion still build "$(comp $2)" "${4:-out/still_$2_$3.png}" --frame=$3 --props="$P" $BROWSER --log=error ;;
  stills)
    [ -d build ] || bundle
    L=$2; TAG=$3; shift 3; mkdir -p out/qa
    for FR in "$@"; do
      npx remotion still build "$(comp $L)" "out/qa/${TAG}_${L}_f${FR}.png" --frame=$FR --props='{"layout":"'$L'"}' $BROWSER --log=error
    done ;;
  film)
    bundle
    # bt709 limited range + tags. (No forced keyframe on 840: tested, x264 then refines the static I-frame on the next
    # P-frame = a 0.68 mean decode step at 842; the default GOP drifts <= 0.03 mean over the frozen frames.)
    npx remotion render build "$(comp $2)" "${3:-out/film_$2.mp4}" --props='{"layout":"'$2'"}' --codec=h264 --crf=18 --color-space=bt709 --pixel-format=yuv420p $BROWSER --concurrency=${CONC:-4} --log=error ;;
  perf)
    [ -d build ] || bundle
    S=$(date +%s.%N)
    npx remotion render build "$(comp $2)" "out/perf_$2.mp4" --frames=$3-$4 --props='{"layout":"'$2'","q":"'${Q:-}'"}' --codec=h264 $BROWSER --concurrency=${CONC:-4} --log=error
    E=$(date +%s.%N)
    N=$(( $4 - $3 + 1 ))
    python3 -c "t=$E-$S; n=$N; print(f'{n} frames in {t:.1f}s -> {1000*t/n:.0f} ms/frame (wall, concurrency ${CONC:-4})')" ;;
  events)
    ./node_modules/.bin/esbuild scripts/export-events.ts --bundle --platform=node --outfile=build/export-events.cjs --log-level=warning
    node build/export-events.cjs > events.json && echo "wrote events.json" ;;
  collide)
    mkdir -p build && ./node_modules/.bin/esbuild scripts/check-collide.ts --bundle --platform=node --outfile=build/check-collide.cjs --log-level=warning
    node build/check-collide.cjs ${2:-} ${3:-} ;;
  cues)
    ./node_modules/.bin/esbuild scripts/export-sfx-cues.ts --bundle --platform=node --outfile=build/export-sfx-cues.cjs --log-level=warning
    node build/export-sfx-cues.cjs > sfx-cues.json && echo "wrote sfx-cues.json" ;;
  wallcheck)
    mkdir -p build && ./node_modules/.bin/esbuild scripts/check-wall.ts --bundle --platform=node --outfile=build/check-wall.cjs --log-level=warning
    node build/check-wall.cjs ;;
  sfx)
    "$0" events && "$0" cues
    ${PY:-python3} scripts/sfx_synth.py events.json sfx-cues.json public/audio out/sfx_timeline.png ;;
  *) echo "usage: see header"; exit 1 ;;
esac
