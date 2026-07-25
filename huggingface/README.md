---
license: cc-by-4.0
pretty_name: GenHome3D-1280
size_categories:
  - 1K<n<10K
tags:
  - 3d
  - usdz
  - openusd
  - blender
  - realitykit
  - visionos
  - synthetic
configs:
  - config_name: default
    data_files:
      - split: train
        path: catalog.csv
---

# GenHome3D-1280

**A benchmark of how an AI-assisted pipeline draws and constructs 1,280
household and spatial-design objects in 3D.**

[Explore the visual catalog](https://lx2026.github.io/genhome3d-1280/) ·
[Browse the GitHub repository](https://github.com/lx2026/genhome3d-1280) ·
[Download the versioned release](https://github.com/lx2026/genhome3d-1280/releases/tag/v1.0.0) ·
[Read the generation method](METHOD.md)

<table>
  <tr>
    <td><img src="previews/seating/armchairs/arm-0001-scandinavian-oak-open-armchair.jpg" alt="Scandinavian oak armchair" /></td>
    <td><img src="previews/lighting/pendants/pnd-0010-satin-brass-thin-disc-pendant.jpg" alt="Satin brass pendant" /></td>
    <td><img src="previews/kitchen-cookware/mixing-bowls/mxb-0014-white-marble-brass-foot-mixing-bowl.jpg" alt="Marble mixing bowl" /></td>
  </tr>
</table>

## Dataset summary

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
| Vision Pro device review | Pending |

The collection covers seating, tables, bedroom furnishings, cabinetry,
office, entryway, kids, outdoor, lighting, bathroom, decor, textiles,
cookware, tableware, and appliances. Every asset has a stable ID, authored
metric dimensions, searchable metadata, an optimized preview, and a
self-contained USDZ package. The original AI design reference is published
beside each result. No object carries a visual review: the published checks are
automated, and nobody has inspected these results by eye.

## Using the dataset

The Hub dataset viewer reads `catalog.csv`. Each row points to the matching
USDZ package and preview image inside this repository.

```python
from datasets import load_dataset

catalog = load_dataset("linxy97/genhome3d-1280", split="train")
print(catalog[0])
```

To fetch an individual package:

```python
from huggingface_hub import hf_hub_download

path = hf_hub_download(
    repo_id="linxy97/genhome3d-1280",
    repo_type="dataset",
    filename="assets/seating/armchairs/arm-0001-scandinavian-oak-open-armchair.usdz",
)
print(path)
```

The GitHub v1.0.0 release remains the canonical single-file archive. This Hub
repository mirrors the unpacked collection so assets, previews, and records
can be inspected or downloaded independently.

## Repository structure

```text
assets/<group>/<category>/<slug>.usdz       Runtime packages
metadata/<group>/<category>/<slug>.json     Per-asset records
previews/<group>/<category>/<slug>.jpg      Optimized previews
references/<group>/<category>/<slug>.jpg    Original AI design references
catalog.csv                                 Dataset-viewer index
catalog.json                                Complete nested catalog
checksums.sha256                            USDZ integrity manifest
reports/publication-audit.json              Publication gate result
METHOD.md                                   Generation and review workflow
```

## Technical checks and intended use

The USDZ packages are self-contained, meter-authored, and checked for stage
integrity, archive safety, texture integrity, authored bounds, placement, and
geometry limits. They are intended for RealityKit-oriented prototyping,
OpenUSD tooling experiments, spatial-design applications, dataset research,
and education.

This release does **not** claim Apple Vision Pro device certification.
On-device review is pending. Validate selected assets in Reality Composer Pro,
Instruments, and on target hardware before shipping them in an application.
See [`VALIDATION.md`](VALIDATION.md) for the checks and their limits.

## Provenance and limitations

The collection was produced through an OpenAI Codex-assisted design,
specification, procedural Blender construction, packaging, and QA workflow.
The assets are generated designs, not scans or authoritative replicas of real
products. They may not be unique. See [`METHOD.md`](METHOD.md) for the
production workflow and [`PROVENANCE.md`](PROVENANCE.md) for the full
provenance statement. Review trademark, trade dress, safety, accessibility,
and regulatory requirements for your use case.

## License and attribution

The USDZ assets and preview images are licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). When redistributing
or adapting them, credit:

> GenHome3D-1280 contributors — https://github.com/lx2026/genhome3d-1280

Supporting software is MIT licensed. See `LICENSE-ASSETS`, `LICENSE`, and
`CITATION.cff` for details.
