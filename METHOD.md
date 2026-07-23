# Method: Building 3D Assets with Codex and Blender

Published with GenHome3D-1280 on July 23, 2026.

This document explains how GenHome3D-1280 was produced and how to apply the
same approach to a smaller collection of your own.

The main lesson is that we did not ask an LLM to operate Blender like a person
and hope it made a good model. Codex treated Blender as a deterministic
renderer and geometry engine. It wrote Python, ran Blender without a user
interface, inspected the outputs, and repeated the process against explicit
asset and validation contracts.

The prompts mattered, but the system around the prompts mattered more.

## What the workflow produced

Every completed asset had:

- a stable ID and fixed dimensions;
- an authoritative design reference;
- procedural Blender geometry with semantic object names;
- portable metallic-roughness materials and textures;
- an editable `.blend` source;
- a hero render and a reverse inspection render;
- a self-contained USDZ package;
- structured metadata and checksums;
- technical, package, and visual review results.

The public dataset contains the final USDZ, preview, metadata, and validation
state. The full Blender sources and production builders remain in the
production archive. This guide describes their structure, but it is not yet a
drop-in release of that internal runtime.

## The production loop

The complete flow was:

```text
category brief
    → fixed asset specifications
    → design references
    → procedural Blender builders
    → Blender source and evidence renders
    → USDZ export
    → technical validation
    → visual review
    → catalog publication
```

We worked one category at a time. Each category had 20 assets and was closed
only after all 20 passed the same checks. This kept a failure in one category
from changing the rules for another category halfway through production.

## 1. Start with one asset

Do not begin with a request such as “make me 1,000 pieces of furniture.”

Choose one object with a clear silhouette and write down:

- its width, depth, and height in meters;
- how it touches the world: floor, tabletop, wall, or ceiling;
- its defining parts and their counts;
- its primary materials;
- a reasonable geometry budget;
- the views required to judge it;
- the files that must exist when the job is finished.

Build and validate that one object before adding batch orchestration.

## 2. Turn the brief into a structured asset specification

The production pipeline did not pass a loose paragraph between stages. Each
asset had a JSON specification similar to this:

```json
{
  "schema_version": 1,
  "id": "ARM-0001",
  "slug": "scandinavian-oak-open-armchair",
  "title": "Scandinavian Oak Open-Arm Armchair",
  "taxonomy": {
    "category": "seating",
    "subcategory": "armchairs",
    "type": "Scandinavian open-arm armchair"
  },
  "dimensions_m": {
    "width": 0.68,
    "depth": 0.76,
    "height": 0.82
  },
  "material_profile": "pale-oak",
  "validation_profile": "furniture-floor",
  "tags": [
    "armchair",
    "scandinavian",
    "oak",
    "open-arm",
    "loose-cushion"
  ],
  "review": {
    "required": true,
    "authoritative_reference": "references/reference.png"
  }
}
```

Fix the dimensions and defining features before modeling starts. If an image
does not provide trustworthy measurements, mark the dimensions as authored or
reference-inferred rather than manufacturer-exact.

The specification becomes the contract shared by the builder, exporter,
validator, catalog, and reviewer.

## 3. Create one authoritative design reference

For each asset, we generated one design reference and treated it as fixed input
for that build.

A useful reference prompt describes visible structure rather than mood alone:

```text
Create a clean studio product reference for one freestanding armchair.
Show the complete object from a front three-quarter view on a plain neutral
background. The chair has four square oak legs, two open paddle arms, one loose
seat cushion, one loose back cushion, and no surrounding props. Keep the design
physically buildable and make every named part clearly visible.
```

The reference is not ground truth for hidden construction or dimensions. The
asset specification owns those facts. The reference owns the visual target.

Do not quietly replace the reference after seeing the model. If the design
changes, record a new revision and rerun the evidence and review stages.

## 4. Split the Blender code into three layers

The production code used three layers instead of generating one unrelated
script per object.

### Shared runtime

The shared runtime handled repeated Blender work:

- scene reset and collection creation;
- rounded boxes, cylinders, curves, lathed profiles, and custom meshes;
- PBR material and texture creation;
- dimension normalization and placement;
- studio, lighting, and camera setup;
- geometry statistics;
- metadata and report writing;
- atomic publication of `.blend` files and renders.

### Category builder

One category module contained reusable construction logic. An armchair module,
for example, defined beams, tubes, cushions, legs, arms, and backs, then
assembled them differently for each armchair ID.

This layer encoded knowledge such as “a rear post continues into the back” or
“a cushion needs thickness and edge softness.” That produced more consistent
results than asking the model to rediscover furniture construction for every
asset.

### Asset wrapper

Each asset had a small entry point that selected the category builder:

```python
from seating_armchairs_asset_builder import build_armchair_asset


def build(*, spec, config, asset_dir, render=True, profile_name=None, profile=None):
    return build_armchair_asset(
        spec=spec,
        config=config,
        asset_dir=asset_dir,
        render=render,
        profile_name=profile_name,
        profile=profile,
    )
```

The asset specification held the dimensions and identity. The category builder
held the construction knowledge. The shared runtime held Blender mechanics.

## 5. Make geometry dimension-driven

Builder code used meters from the start:

- Blender source: Z-up;
- one Blender unit: one meter;
- origin: center of the placement footprint or mounting plane;
- floor objects: minimum Z at zero;
- ceiling objects: maximum Z at zero;
- wall objects: minimum Y at zero before export.

Parts were named for what they represented, such as
`left_rear_leg`, `seat_cushion`, or `back_crest`, rather than `Cube.001`.

A simplified category function looked like this:

```python
def build_open_armchair(context):
    frame = context.material("pale-oak")
    fabric = context.material("oatmeal-fabric")

    context.rounded_box(
        "seat_cushion",
        location=(0.0, -0.03, 0.47),
        dimensions=(0.52, 0.47, 0.12),
        material=fabric,
        bevel=0.035,
    )

    add_four_legs(context, frame, seat_height=0.43)
    add_open_arms(context, frame, arm_height=0.64)
    add_back_posts_and_cushion(context, frame, fabric)
```

This example is pseudocode; the helper runtime is not included in the public
dataset. The important pattern is to express geometry through named,
dimensioned operations that an agent can inspect and revise.

After construction, the production runtime normalized the complete asset to
the authored envelope and rejected it when:

- its placement plane was wrong;
- its evaluated geometry exceeded 75,000 triangles;
- it had no published material;
- required outputs were missing or stale.

Normalization is a final guard, not a substitute for plausible part
dimensions. A badly proportioned chair can still fit inside the correct
bounding box.

## 6. Build without the Blender interface

Each asset was built in a fresh Blender process:

```bash
blender \
  --background \
  --factory-startup \
  --python tools/build_asset.py \
  -- --asset ARM-0001
```

The `--factory-startup` flag prevented a user preference or startup file from
changing the result. Running one asset per process also contained crashes,
memory leaks, and stale scene state.

The production pipeline allowed at most two Blender jobs at once. More
parallelism was not automatically faster because renders, texture generation,
and Blender startup all compete for memory and CPU.

For a new project, pin the Blender version used to build and export. The final
GenHome3D USDZ export used Blender 5.2.0 LTS; some source files were authored
with earlier Blender versions.

## 7. Publish materials, not viewport tricks

The assets used a metallic-roughness workflow:

- base color;
- roughness;
- metallic value where appropriate;
- normal or surface detail when needed;
- 2K textures under the production profile.

Procedural Blender nodes can look good inside Blender and disappear or change
during USDZ export. Bake or generate portable texture maps and make their file
paths relative to the asset.

Keep material slots under control. A visually simple object split across many
materials and objects can cost more to render than its triangle count suggests.

## 8. Render two pieces of evidence

Every build produced:

1. a front three-quarter hero render;
2. a reverse inspection render.

The hero render judged the main silhouette and material read. The inspection
render exposed rear construction, joins, thickness, and parts that the hero
camera could hide.

Both views used a consistent neutral studio. Camera distance scaled with the
asset footprint so a bed and a bowl could use the same rendering system
without arbitrary framing fixes.

The production profile used 1000 × 750 evidence renders. These were review
artifacts, not final marketing renders.

## 9. Export an asset-only USDZ

The export process opened the saved `.blend` in a separate, pinned Blender
environment and worked on an in-memory copy.

Before export it:

- converted curves to meshes because USD curve radii were not reliable;
- applied remaining render-time mesh modifiers;
- normalized the export copy to the authored dimensions;
- applied scale without baking unwanted location or rotation;
- removed the studio, cameras, lights, and all non-asset objects;
- selected only the asset hierarchy;
- exported with Y-up orientation and meters;
- copied textures into the USDZ with relative paths.

The core Blender export used `bpy.ops.wm.usd_export` with settings equivalent
to:

```python
bpy.ops.wm.usd_export(
    filepath=output_path,
    selected_objects_only=True,
    export_animation=False,
    export_materials=True,
    generate_preview_surface=True,
    convert_orientation=True,
    export_global_forward_selection="NEGATIVE_Z",
    export_global_up_selection="Y",
    export_textures_mode="NEW",
    relative_paths=True,
    export_lights=False,
    export_cameras=False,
    convert_scene_units="METERS",
)
```

Do not export directly over the last known-good package. Write a candidate,
validate it, and replace the canonical USDZ only after it passes.

## 10. Validate the package, not only the Blender scene

The USDZ was reopened through OpenUSD after export. The technical gate checked:

- the stage opens;
- the up axis is Y;
- meters per unit is `1.0`;
- packaged mesh bounds match the authored width, height, and depth;
- dimensional error stays within 1% or 5 mm, whichever is larger;
- the exported object reaches its required placement plane;
- archive members use safe relative paths;
- USDZ archive alignment is valid;
- expected textures are present and byte-integrity checks pass;
- file size and SHA-256 are recorded.

This caught failures that were invisible in the `.blend`, including missing
textures, double-applied transforms, accidental studio exports, and packages
that looked correctly sized in Blender but opened at the wrong scale.

Technical validity is not Vision Pro certification. Test selected packages in
Reality Composer Pro, the target app, and physical hardware before shipping.

## 11. Review against named criteria

The authoritative reference, hero render, and inspection render were placed
on one comparison board. Each asset received a pass or fail for:

1. silhouette;
2. proportions;
3. topology and defining feature counts;
4. material fidelity;
5. surface detail;
6. construction realism;
7. presentation.

The evidence board and its source inputs were sealed with SHA-256. If the
builder, `.blend`, textures, reference, or renders changed, the old review
could not be reused as if it still described the current asset.

Keep visual and technical review separate. A package can be structurally valid
and still be a poor model.

## 12. Scale through manifests and resumable stages

Only after one asset worked did the production system add collection
manifests. A manifest fixed the asset IDs and release membership:

```json
{
  "collection_id": "armchairs-0001-0020",
  "assets": [
    {"id": "ARM-0001", "review_required": true},
    {"id": "ARM-0002", "review_required": true}
  ]
}
```

The automated stages were:

```text
build → export → evidence → report → finalize → index → validate
```

Each stage fingerprinted its actual inputs. An unchanged asset was skipped,
and a failed asset could be repaired without rebuilding successful siblings.
Collection-level catalog generation happened only after asset-level work
passed.

For a small project, a shell script and a JSON status file are enough. The
important behavior is:

- one stable ID per asset;
- explicit inputs and outputs for every stage;
- resumable failures;
- no silent replacement of accepted artifacts;
- a final collection audit.

## Prompt template

The following is closer to the production brief than “open Blender and make a
chair”:

```text
Build one real-scale procedural Blender asset from the attached reference and
JSON specification.

Requirements:
- Treat the JSON dimensions and placement rules as authoritative.
- Use Blender Python and run Blender headlessly.
- Put all asset geometry in one semantically named root collection.
- Use named parts and physically plausible thicknesses and joins.
- Use portable metallic-roughness materials with relative texture paths.
- Keep evaluated geometry below 75,000 triangles.
- Save an editable .blend, a hero render, a reverse inspection render,
  structured metadata, and a self-contained USDZ.
- Export only the asset. Do not include the studio, cameras, or lights.
- Validate Y-up orientation, meters, package contents, bounds, placement,
  textures, and checksums.
- Compare the reference, hero, and inspection views against silhouette,
  proportions, topology, materials, surface detail, construction realism, and
  presentation.
- If a check fails, repair the builder or specification and rerun the affected
  stages. Do not waive the check or claim on-device validation.

Continue until the required files exist and every non-device gate passes.
Report the final dimensions, triangle count, package size, and remaining
limitations.
```

Give the agent access to the repository and commands it needs. Ask it to leave
scripts, specifications, and reports behind. A chat transcript alone is not a
reproducible asset pipeline.

## Common failure modes

### Prompting the interface

Mouse and keyboard automation was too fragile for repeatable modeling. Python
scripts made geometry reviewable, rerunnable, and repairable.

### Starting from style instead of construction

“Make it Scandinavian” is not enough. Name the legs, rails, cushions, panels,
handles, hinges, and other defining parts.

### Treating the reference as dimensional truth

Perspective images do not provide exact measurements. Author dimensions
separately and record their confidence.

### Using procedural materials that never leave Blender

Preview the exported package, not only the Blender material viewport. Portable
textures need to be inside the USDZ.

### Exporting the studio

Selection flags alone were not always enough. The production exporter removed
non-asset objects from its in-memory copy before writing USDZ.

### Reviewing only the attractive angle

The inspection view caught missing rear rails, floating parts, implausible
joins, and paper-thin surfaces.

### Scaling before the contract is stable

Batch generation multiplies ambiguity. Finish one asset, freeze its contract,
then build the collection machinery.

## A practical definition of done

Before accepting an asset, confirm:

- [ ] stable ID, title, category, and version are recorded;
- [ ] dimensions are in meters and their source is stated;
- [ ] source axes, export axes, origin, and placement are explicit;
- [ ] editable `.blend` and reproducible Python builder exist;
- [ ] objects have semantic names;
- [ ] geometry stays within the chosen budget;
- [ ] materials and textures survive USDZ export;
- [ ] hero and inspection renders show the complete object;
- [ ] USDZ opens as a Y-up, meter-authored stage;
- [ ] packaged bounds and placement match the specification;
- [ ] package paths, textures, size, and checksum pass;
- [ ] all seven visual criteria pass;
- [ ] device review remains pending until it happens on device.

## Related documents

- [`PROVENANCE.md`](PROVENANCE.md) records what was generated and what remains
  in the production archive.
- [`VALIDATION.md`](VALIDATION.md) defines the public validation claims and
  their limits.
- [`catalog.json`](catalog.json) shows the metadata produced by the finished
  pipeline.
