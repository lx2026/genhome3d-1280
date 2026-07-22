# Validation

The public release is generated only after all 1,280 source assets pass their
category production contracts.

## Asset-level technical checks

- USDZ archive opens as a USD stage.
- Archive members use safe relative paths and meet USDZ alignment rules.
- Every expected texture is included and integrity checked.
- Authored bounds match the fixed asset specification.
- Source geometry reaches the required placement plane.
- Exported orientation and placement match the category profile.
- Evaluated triangle count remains below the 75,000-triangle asset limit.
- Package SHA-256 and file size are sealed into the technical state.

## Visual review criteria

Each asset receives an evidence-bound pass/fail review for:

1. Silhouette
2. Proportions
3. Topology and defining feature counts
4. Material fidelity
5. Surface detail
6. Construction realism
7. Presentation

The public catalog includes assets only when the technical result, package
audit, and visual review are all `pass`.

## Collection gate

Each category was closed only after all 20 assets passed strict packaging, the
current pipeline reached a fixed point, and the project regression suite
passed. The completed expansion records 64/64 categories and 1,280/1,280
assets.

The generated [`reports/publication-audit.json`](reports/publication-audit.json)
verifies the public copy count, per-category count, source checksums, pass
states, and geometry range.

## Important boundary

Apple Vision Pro on-device review is pending. Technical USDZ validity and
evidence-bound visual review do not constitute device certification or a
guarantee of performance in a particular application. Validate selected
assets in Reality Composer Pro, Instruments, and on target hardware before
shipping.
