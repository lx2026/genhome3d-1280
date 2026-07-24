# GenHome3D-1280

**A benchmark of how an AI-assisted pipeline draws and constructs 1,280
household and spatial-design objects in 3D.**

[Explore the visual catalog](https://lx2026.github.io/genhome3d-1280/) ·
[Browse on Hugging Face](https://huggingface.co/datasets/linxy97/genhome3d-1280) ·
[Download release archives](https://github.com/lx2026/genhome3d-1280/releases) ·
[Read the generation method](METHOD.md) ·
[Read the technical checks](VALIDATION.md)

<table>
  <tr>
    <td><img src="previews/seating/armchairs/arm-0001-scandinavian-oak-open-armchair.jpg" alt="Scandinavian oak armchair" /></td>
    <td><img src="previews/lighting/pendants/pnd-0010-satin-brass-thin-disc-pendant.jpg" alt="Satin brass pendant" /></td>
    <td><img src="previews/kitchen-cookware/mixing-bowls/mxb-0014-white-marble-brass-foot-mixing-bowl.jpg" alt="Marble mixing bowl" /></td>
  </tr>
</table>

## At a glance

| | |
|---|---:|
| Assets | 1,280 |
| Categories | 64 |
| Assets per category | 20 |
| Runtime format | USDZ |
| Units | Meters |
| Asset license | CC BY 4.0 |
| Original AI references | 1,280 |
| Automated package checks | 1,280/1,280 recorded |
| AI visual review | 1,280/1,280 pass |
| Vision Pro device review | Pending |

GenHome3D-1280 records the output of one repeatable AI-assisted pipeline across
seating, tables, bedroom furnishings, cabinetry,
office, entryway, kids, outdoor, lighting, bathroom, decor, textiles,
cookware, tableware, and appliances. Each category contains exactly 20 assets
with stable IDs, authored dimensions, searchable metadata, an original AI
reference, a generated preview, and a self-contained USDZ package. The visual
review was also performed by Codex and is benchmark output, not human curation.

## Download

Download individual assets directly from [`assets/`](assets) or the
[Hugging Face mirror](https://huggingface.co/datasets/linxy97/genhome3d-1280),
or use the complete archive attached to the latest GitHub release.

```bash
# Clone the full collection (approximately 1.2 GB including previews)
git clone --depth 1 https://github.com/lx2026/genhome3d-1280.git

# Verify every USDZ package
cd genhome3d-1280
sha256sum --check checksums.sha256
```

The compact [`catalog.json`](catalog.json) and [`catalog.csv`](catalog.csv)
indexes contain IDs, titles, category paths, dimensions, geometry counts,
download URLs, file sizes, checksums, and technical check results.

## Repository layout

```text
assets/<group>/<category>/<slug>.usdz       Runtime packages
metadata/<group>/<category>/<slug>.json     Per-asset records
previews/<group>/<category>/<slug>.jpg      Optimized hero previews
references/<group>/<category>/<slug>.jpg    Original AI design references
catalog.json                                Complete machine-readable catalog
catalog.csv                                 Flat analysis-friendly catalog
checksums.sha256                            USDZ integrity manifest
reports/publication-audit.json              Publication gate result
METHOD.md                                   Generation and review workflow
site/                                       GitHub Pages source
tools/build_publication.py                  Reproducible export script
```

## RealityKit and visionOS

The USDZ packages are self-contained, meter-authored, and checked for stage
integrity, archive safety, texture resolution, bounds, and placement. They are
suited to RealityKit-oriented prototyping and asset-pipeline research.

This release does **not** claim Apple Vision Pro device certification. The
asset-local production records mark on-device Vision Pro review as pending.
Always test the objects you ship in Reality Composer Pro and on your target
hardware.

## Attribution

When redistributing or adapting the assets, credit:

> GenHome3D-1280 contributors — https://github.com/lx2026/genhome3d-1280

See [`LICENSE-ASSETS`](LICENSE-ASSETS) for the asset license and
[`LICENSE`](LICENSE) for the software and site license.

## Provenance and limitations

The collection was created through an OpenAI Codex-assisted design,
specification, procedural Blender construction, packaging, and QA workflow.
Generated design references guided production and are published beside the
result so the benchmark can be inspected directly. See [`METHOD.md`](METHOD.md) for the production
workflow, [`PROVENANCE.md`](PROVENANCE.md) for origin and disclosure details,
and [`VALIDATION.md`](VALIDATION.md) for the technical checks and their limits.

The assets are generated designs, may not be unique, and should not be treated
as scans or authoritative replicas of real products. Review trademark, trade
dress, safety, accessibility, and regulatory requirements for your use case.

## Citation

Citation metadata is available in [`CITATION.cff`](CITATION.cff).
