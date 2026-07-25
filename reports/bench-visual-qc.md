# Bench Visual QC — Claude Opus 5 rebuilds, 2026-07-25

Independent visual audit of all 68 Opus 5 bench rebuilds against their
authoritative reference images. Each asset's reference, hero render and reverse
inspection render were compared; every candidate defect was then re-examined by a
second reviewer instructed to refute it. 61 candidates were raised and 60 survived.

Camera, lighting, texture detail and simplified ornament were out of scope.

## Result

- 68 rebuilds audited; 29 clean, 39 carrying at least one confirmed defect.
- 60 defects confirmed: 13 blocking, 31 major, 16 minor.
- 18 are now fixed, including every blocking one (0 blocking outstanding).
- 42 remain, listed below and left in the published builds.

Fixing every remaining defect would make the bench a measure of how long the
author kept iterating rather than of what the model built, so the outstanding
list stays in the record. The blocking ones were repaired because they made an
object unreadable: a detached handle, a chandelier hanging off its column,
forks with no tines.

## Confirmed defects

### ART-1001

- **blocking** (floating-part) — **fixed**: The figure-eight ribbon is completely detached from its support: it hovers in mid-air roughly 6 cm above the tip of the base post, touching nothing.

### BLK-1001

- **blocking** (intersecting-part) — **fixed**: The twelve tassels are buried inside the folded stack instead of hanging off the front edge, so the reference's defining tassel fringe does not read at all.
- **major** (floating-part) — **fixed**: The woven ladder-band trim is detached and floats in mid-air at both ends of the throw.
- **major** (degenerate-geometry) — **fixed**: Each fold layer tapers to a zero-thickness knife point at its left and right ends, so the object reads as three sheets of sharp card rather than a folded textile.

### CHD-1001

- **blocking** (floating-part) — **fixed**: The entire eight-arm candle cluster is detached from the central column and hangs in mid-air roughly 0.17 m below it.
- **major** (floating-part) — **fixed**: The drop finial floats free below the arm hub instead of being attached under the central ball.
- **minor** (missing-feature): The eight candle lamps are absent; each candle sleeve ends as a bare flat-topped tube.

### CHR-1002

- **blocking** (floating-part) — **fixed**: The continuous arm bow's two forward ends stop in mid-air as blunt, flat-cut tube ends about 0.2 m above the seat — the chair has no arms at all.
- **major** (proportion): The seat is a plain square-cornered rectangular board roughly as deep as it is wide, instead of the reference's shaped saddle seat.

### CUT-1001

- **blocking** (missing-feature) — **fixed**: Neither fork has tines - both fork pieces are solid convex almond-shaped heads with no slots cut through them.
- **blocking** (missing-feature) — **fixed**: The knife has no blade - the middle piece is the same convex blob as the forks, with no flat blade, cutting edge, serration or bolster.
- **blocking** (missing-feature) — **fixed**: Both spoons have convex domed heads instead of hollow bowls - there is no cavity at all.
- **major** (proportion): All five handles are bulbous round-section ellipsoids rather than flat flatware handles, so every piece reads as a dumbbell rather than cutlery.

### KSE-1001

- **blocking** (geometry-broken) — **fixed**: The seven back spindles overshoot the bent hoop and stand roughly 9 cm proud of it, so the chair back reads as a ragged picket fence with a small arch buried inside it instead of a hoop-back enclosing the spindles.

### KST-1001

- **blocking** (floating-part) — **fixed**: All four turned bun feet are detached from the cabinet: they stand on the floor as separate free-floating bodies roughly 6-7 cm below the carcase underside, so the case itself hovers with no visible support.

### KTL-1001

- **blocking** (floating-part) — **fixed**: The arched handle is completely detached from the kettle body — both handle legs end in mid-air outboard of the shoulder instead of landing on brackets fixed to the body.
- **major** (missing-feature): The whistle cap on the spout is entirely missing; the spout is a bare open cone.

### TLP-1001

- **blocking** (wrong-orientation) — **fixed**: The brass yoke is built upside down: it arcs up over the stem as an inverted U with both ends hanging free in mid-air, joined neither to the stem below nor to the shade above.
- **blocking** (floating-part) — **fixed**: The green glass shade hovers unsupported above the arm; nothing structural touches it.
- **major** (broken-surface) — **fixed**: The top of the brass stem is an uncapped opening that renders as a black cavity, with the pull chain modelled as a bare straight rod dropping into the hole.

### VNY-1001

- **blocking** (floating-part) — **fixed**: The whole tri-fold mirror assembly hovers above the vanity top: both wings float roughly 4 cm clear of the surface with nothing supporting them, and the centre panel plus its foot stand about 1 cm clear.
- **major** (wrong-orientation) — **fixed**: The two mirror wings are detached from the centre panel and splay backward instead of hinging on the centre frame's stiles and angling forward, so the mirror reads as three separate free-standing boards.

### ARM-1001

- **major** (floating-part): Both armrests are cantilevered off the rear posts and their front ends terminate in mid-air; the front legs stop at seat-rail height with free rounded tops, so nothing supports the front of either arm.

### BAR-1001

- **major** (floating-part): The brass foot ring is detached from the pedestal: its four support brackets stop in mid-air about 30 mm short of the turned column, so the ring hangs unsupported around the pillar.

### BEN-1001

- **major** (floating-part): The lower shoe rack (two end stretchers plus three dowels) is a detached sub-assembly floating in mid-air; it does not touch any leg.

### BFX-1001

- **major** (floating-part): The cistern floats about 3 cm above the shelf it should sit on - the tank is a detached block hanging in the air over the bowl.

### CON-1001

- **major** (missing-feature): The defining three-drawer bow front is absent: the frieze under the top is one unbroken bowed mahogany band with no drawer fronts, reveals, dividers or cockbeading anywhere along it.
- **minor** (proportion): The drawer pulls are reduced to tiny vertical brass tabs standing edge-on out of the apron instead of the reference's wide oval brass bail plates, and only two of the three are discernible.

### CRK-1001

- **major** (wrong-assembly): The two side boards run the full 0.42 m depth of the envelope while the case front (mirror panel, hooks, lower panel) sits at the very back, so the sides project about 27 cm forward as bare fins and the front of the piece reads as a deep recess between two loose slabs.
- **major** (wrong-shape): The oval mirror is built as a rectangular glass plate with a thin oval ring laid on top, so four pale rectangular corners of glass stick out beyond the frame.

### CUR-1001

- **major** (missing-feature): The pinch-pleat header is absent: each panel hangs from four plain posts that pass straight through the rod rather than triple-fold pleats carried on hooks/rings over it.

### CWR-1001

- **major** (proportion): The pan body is built as a deep rounded bowl rather than a shallow skillet, so the piece reads as a serving bowl or saucier with a stick handle.
- **minor** (broken-geometry): The helper-handle tube pinches and self-intersects at its outer apex, leaving a creased dark faceted notch where the loop turns.

### DRS-1001

- **major** (intersecting-part): The three long-drawer brass bail pulls are sunk inside the bowed drawer fronts, so only a thin sliver of the bail crest protrudes and both rosettes are buried in the wood.
- **major** (misplaced-part): The two front bracket feet stand entirely proud of the case front, so each foot block's top face is exposed under open air rather than tucked beneath the base moulding.

### FLR-1001

- **major** (floating-part): The cone shade is detached from the arm: it hangs about 15 mm below the socket knuckle at the end of the bridge arm, with nothing joining the two.
- **minor** (missing-feature): The lamp has no bulb or socket lamping inside the open shade.

### GLW-1001

- **major** (material): The clear-glass body renders as a milky, near-opaque frosted white, so the tumbler reads as a translucent plastic beaker rather than the reference's clear heavy-base glass.

### MIR-1001

- **major** (material): The mirror glass disc carries a coarse wavy brushed-metal pattern, so the reflective face reads as corrugated metal rather than flat glass.

### MXB-1001

- **major** (missing-feature): The turned foot ring the bowl stands on is absent; the bowl has a continuously rounded bottom that meets the floor at a tangent point instead of a flat standing face.

### ODT-1001

- **major** (wrong-orientation): The twelve top slats run lengthwise (the full 1.90 m long axis, arrayed across the 0.92 m depth) instead of running across the table's width and being arrayed along its length as in the reference, so the reference's broad cross-slat top with its wide central gap is not reproduced.

### OST-1001

- **major** (wrong-orientation): The eleven lid slats run the wrong way: they are laid lengthwise along the 1.28 m width instead of front-to-back across the depth, so the chest's long front edge is a smooth continuous slab.
- **minor** (missing-feature): The recessed carry grip in each end of the chest is absent from the visible model.

### OTT-1001

- **major** (missing-feature): The piped seam that rings the top face of the pouf is entirely absent from the render - the piping cord was authored inside the drum body and is buried below its surface.

### PLT-1001

- **major** (proportion): The urn is built as a tall pot instead of the reference's wide, low oval cistern - the silhouette is roughly 2.3x too slender, so it reads as a bucket rather than a lead cistern planter.

### SAP-1001

- **major** (missing-feature): The blade assembly inside the jar is entirely missing.

### SCN-1001

- **major** (proportion): The whole fixture renders stretched sideways, so the tall parts read as squat and wide: the ribbed glass shade is wider than it is tall, and the oval backplate reads as a round disc.
- **minor** (proportion): The bobeche renders as a wide flat brim that overhangs the glass shade on every side, instead of a compact turned cup narrower than the shade base.

### SHS-1001

- **major** (broken-surface): The seat cushion's quilted top face is built as a sharp sawtooth ridge that renders near-white, so the cushion reads as a broken/spiked surface instead of a soft buttoned leather pad.

### WRD-1001

- **major** (wrong-shape): The broken swan-neck pediment is built as two thin round rods forming a shallow unbroken hoop, so it reads as a suitcase carry handle bolted to the cabinet top rather than a scrolled crest.

### BAK-1001

- **minor** (stray-geometry): Knife-thin slivers of stray geometry project horizontally out of the rim bead at the two long sides, plus a triangular tab under the front-right corner - the pan's outline is not clean.

### CTB-1001

- **minor** (missing-feature): The board's plan corners are square; the reference's generously rounded plan corners are absent.

### KNV-1001

- **minor** (wrong-profile): The blade's spine runs dead straight all the way to the point, so the tip sits at spine level and the last few centimetres are a thin spike rather than the reference's dropped chef-knife tip.

### KTN-1001

- **minor** (wrong-shape): The blade toe pinches to a narrow chamfered point instead of the reference's broad flat scraping edge, which is the defining working feature of a jar spatula.
- **minor** (missing-feature): The hanging hole through the handle is entirely absent.
- **minor** (missing-feature): The handle butt terminates in a flat cut-off disc instead of the reference's fully rounded end.

### NST-1001

- **minor** (construction-gap): An open slot roughly 2 cm high sits between the underside of the top and the top edge of the drawer front, so you look into the empty carcase above the drawer box.

### ODS-1001

- **minor** (missing-feature): The bench's defining stepped (pagoda) crest with an open arched crown is absent; the back terminates in a single straight full-width rail with one solid raised block over the centre bay.

### RUG-1001

- **minor** (proportion): The navy stripes are too wide relative to the ivory grounds, so the rug reads as an evenly banded stripe rather than narrow navy bands on a broad ivory field.

### TSK-1001

- **minor** (open-shell): The back of the brass shade has an open unplugged hole that looks straight into the hollow interior; nothing joins the shade shell to the pivot knuckle.
