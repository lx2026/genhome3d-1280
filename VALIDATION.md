# Technical Checks

This benchmark records the output of an AI-assisted generation pipeline. The
checks below describe package structure and authored scale. They do not mean the
objects are correct, realistic, safe, or production-ready, and no published
check reflects a human looking at the result.

## Asset-level technical checks

- USDZ archive opens as a USD stage.
- Archive members use safe relative paths and meet USDZ alignment rules.
- Every expected texture is included and integrity checked.
- Authored bounds match the fixed asset specification.
- Source geometry reaches the required placement plane.
- Exported orientation and placement match the category profile.
- Evaluated triangle count remains below the 75,000-triangle asset limit.
- Package SHA-256 and file size are sealed into the technical state.

## No visual review is published

The production pipeline ran an automated self-review of its own renders. Those
verdicts are not published, and no version of them is a human judgment, so this
dataset makes no visual-review claim at all. Every object ships with its
reference image and both renders precisely so you can judge the result yourself.
Visible mistakes remain in assets whose technical checks pass.

## Collection gate

Each category was closed only after all 20 assets passed strict packaging, the
current pipeline reached a fixed point, and the project regression suite
passed. The completed expansion records 64/64 categories and 1,280/1,280
assets.

The generated [`reports/publication-audit.json`](reports/publication-audit.json)
verifies the public copy count, per-category count, source checksums, technical
pass states, and geometry range.

## Important boundaries

Apple Vision Pro on-device review is pending. Technical USDZ validity does not
constitute device certification or a guarantee of performance in a particular
application. Validate selected
assets in Reality Composer Pro, Instruments, and on target hardware before
shipping.
