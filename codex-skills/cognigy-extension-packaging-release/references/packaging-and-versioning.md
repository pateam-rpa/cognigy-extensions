# Packaging And Versioning

## Package Layout

This workspace family often uses sibling package folders, for example:

- `<normal-node-extension>/`
- `<knowledge-connector-extension>/`

Run package commands from the package folder unless a root wrapper explicitly exists.

Common package scripts:

- `npm run transpile`
- `npm run lint`
- `npm run smoke`
- `npm run zip`
- `npm run zip:source`
- `npm run build`

`npm run build` should usually mean `transpile -> lint -> smoke -> zip`.

## Upload Tarballs

The Cognigy upload tarball should contain only what Cognigy needs:

- `build/*`
- `package.json`
- `package-lock.json`
- `README.md`
- `icon.png`

Verify:

- Archive integrity.
- Embedded `package.json` version.
- Presence of `build/module.js`.
- No source-only docs unless the package intentionally includes them.
- `icon.png` is exactly `64x64` both locally and inside the tarball.

When confidence matters, extract the tarball into a temp directory, run `npm install --omit=dev`, and require `build/module.js`.

## Source ZIPs

Source ZIPs are for colleagues/reviewers, not Cognigy upload.

Include:

- `src/`
- `scripts/`
- `README.md`
- `DEVELOPMENT.md` when present.
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tslint.json`
- `icon.png`

Exclude:

- `.git/`
- `node_modules/`
- `build/`
- `.DS_Store`
- upload tarballs.
- source ZIPs.
- nested wrapper ZIPs.
- local caches and temp files.

Use versioned names when package scripts support them, for example `<extension-name>-source-vX.Y.Z.zip`.

## Wrapper ZIPs

When asked for "one zip with all files", create a fresh wrapper ZIP with exactly the intended entries.

Typical four-file wrapper:

- `<normal-extension>.tar.gz`
- `<normal-extension>-source-vX.Y.Z.zip`
- `<knowledge-extension>.tar.gz`
- `<knowledge-extension>-source-vA.B.C.zip`

Rules:

- Do not update an existing wrapper ZIP in place; stale entries can remain.
- Use a fresh, versioned wrapper filename.
- Verify exact membership with `zipinfo` or equivalent.
- Run `unzip -tq`.
- Confirm source ZIP exclusions separately.

## Versioning

- Use valid semver. If the user says `0.1`, write `0.1.0`.
- Update both `package.json` and package-lock metadata.
- Rebuild the upload artifact after a package version change.
- Verify embedded tarball versions, not just source files.
- Bump versions for upload-visible behavior changes and schema/descriptor changes.
- Do not invent a version bump for docs-only work unless the user asks.
- If Cognigy may cache an old schema, bump and reupload, then create a new connection.

## README And Development Docs

- Keep `README.md` high-level and user-facing because it is included in upload tarballs.
- Put maintainer setup, architecture, troubleshooting, and limitations in package-local `DEVELOPMENT.md`.
- After substantive package work, inspect README Version Log sections.
- If the user asks to record what was done, update the existing version-log entry in place unless a version bump is already part of the work.
- Do not repackage just because a docs-only version-log entry was added unless requested.

## Icon Handling

Cognigy upload validation requires a square `64x64` icon.

- Use a supplied or official product asset only when appropriate.
- Resize to exactly `64x64`.
- Verify local `icon.png`.
- Verify packaged `icon.png` inside the tarball.

## Git And Dirty Trees

- Inspect dirty state before packaging.
- Do not revert unrelated user changes.
- Generated artifacts may be ignored and remain on disk while the git tree is clean.
- When committing, clearly distinguish tracked source/docs/config changes from ignored generated artifacts.
