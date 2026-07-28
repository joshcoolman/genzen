# primitives/ — temporary

A staging folder, not a convention. It exists so the primitives being smoked out
of the #185 conversion are visible as a group while we decide whether each one
holds up.

`~/repos/project-standard` forbids grouping-by-kind folders here — "the folder
listing _is_ the catalogue… no grouping-by-area folders adding a dig" — and #181
already flattened this directory once. **These move up into `src/components/`
before the pass closes**, and this file goes with them.

Everything inside still follows the real rules: one folder per component, a
co-located `*.module.css`, exported from the single root barrel `#/components`.
