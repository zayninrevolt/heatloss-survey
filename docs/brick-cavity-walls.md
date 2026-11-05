# Brick / cavity / brick / plaster wall presets

The external-wall dropdown and property construction defaults include two optional
brick-inner-leaf examples. They do not replace the existing generic cavity-wall
or aerated-block options, change existing saved selections or infer a construction
from property age.

## Published values and limits

Source: The Open University, *Energy in buildings*, section 2.2.6, Activity 7,
Tables 7 and 8 and the published answers:
https://www.open.edu/openlearn/nature-environment/energy-buildings/content-section-3.2.6

- **Brick, unfilled cavity, brick + plaster**: **1.49 W/m²K**.
- **Brick, filled cavity, brick + plaster (50mm mineral wool)**: **0.52 W/m²K**.

These are the source's worked examples with 115mm brick leaves and a plaster
finish (13mm). The filled example uses a 50mm cavity full of mineral wool with
conductivity 0.035 W/mK. These are not universal RdSAP defaults or a calculation
for an arbitrary wall. Confirm that the recorded build-up matches, particularly
the insulation type and cavity width. Different brickwork, cavity widths, partial
fill, damp insulation or other finishes can give a different U-value. Do not
select the filled example just because insulation is believed to be present.

The form explains the build-up and source. Printed room assumptions name the
selected construction, U-value, source and build-up. Both options use the normal
outdoor wall boundary, net opaque area and existing bridging rules. No engine,
age defaults, persistence schema or calculation-method version is changed.

Regression: `test/browser/brick-cavity-walls.spec.js` verifies each option's
resolved U-value and independent U × net area × temperature-difference change,
unchanged ventilation/age-based bridging, exact restoration of prior results,
autosave/reload, JSON import into a fresh context, actual PDF output, and
property-wide application.
