# Provenance

GenHome3D-1280 contains the 1,280 assets produced by the repository's
2026-07-17 empty-category expansion program. That program filled 64 previously
empty household-object categories with exactly 20 assets each.

## Production workflow

Each category passed through the same ordered workflow:

1. Define a dated category contract, collection manifest, and 20 fixed asset
   specifications.
2. Generate a category style board and one authoritative design reference per
   asset with the built-in image-generation tool.
3. Construct geometry, materials, textures, and renders procedurally in
   Blender from asset-local Python wrappers and a shared runtime.
4. Export a self-contained USDZ package and seal technical evidence.
5. Have Codex review the generated reference, hero render, and reverse
   inspection render against seven visual criteria.
6. Run strict packaging and collection-level regression checks before closing
   the category.

The production metadata identifies OpenAI Codex as the authoring assistant.
The public record intentionally does not claim a specific GPT model version
because that model identity was not sealed in each asset's provenance record.

## Model benches

A bench publishes more than one build of the same reference image so different
models can be compared directly.

Bench entries name their model in the production bench registry. That name is a
declaration by the repository owner rather than a sealed record: the expansion
program's assets seal only "OpenAI Codex" as the authoring assistant, with no
model version. Builds made after asset specs gained an attribution block seal
their own author, model, and harness, and `benchmarks.json` reports whichever of
the two each entry has.

Bench rebuilds are not part of the 1,280-asset dataset. They are excluded from
the category counts, the catalog indexes, and `checksums.sha256`.

## Included in this public dataset

- Final USDZ package
- Optimized preview derived from the final hero render
- Web-sized copy of the original AI design reference
- Compact public metadata
- SHA-256 package checksum
- Dataset- and asset-level validation status

## Retained in the production archive

- Blender source files and builder scripts
- Generated style boards and full-resolution authoritative reference images
- Full-resolution textures outside the USDZ package
- Inspection renders and comparison boards
- Internal manifests, reports, and regression artifacts

The retained material is excluded to keep the public dataset focused on
runtime consumption and to avoid exposing redundant production evidence.

## Originality and identity

The assets are generated designs rather than scans. Names describe visible
form, material direction, construction cues, and object type. They do not
assert affiliation with a manufacturer or claim to reproduce a specific
commercial product.
