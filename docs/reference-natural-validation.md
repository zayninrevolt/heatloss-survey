# Natural-ventilation reference validation

This is a separately versioned, **experimental comparison path**, not a replacement
for the legacy Worcester/workbook boiler calculation and not an equipment-selection
or MCS-compliance claim.

## What changed

`McsVentilation.calculateNaturalZone()` now applies a sourced zone infiltration
calculation, room-envelope leakage allocation, a room peak cap and distinct room
and zone heat-loss expressions. The previous experimental v1 volume-share helpers
remain for API compatibility only; the new reference check never calls them.

`ReferenceNaturalDesign.calculate()` combines those flows with the existing
`McsFabricCalculations.calculateElement()` results. Bridging is additive at each
element's own boundary: `(U + bridgeAllowance) * netArea * deltaT`.
Heated internal transfers stay signed for room emitters and are excluded from the
building fabric sum. External openings replace opaque fabric; they are not counted twice.

The local UI adds a collapsed experimental check inside the existing Heat-pump
design review and mirrors its scope and results into the Heat Loss print sheet.
It derives existing room inputs and adds conditional shared-interface fields within the existing room section, with one canonical record instead of duplicate room-side measurements.
It does not change radiator selection, boiler recommendation, stored calculation
method or the existing room/property totals.

## Sources and equations

- [Brack, HAW Hamburg thesis (2023)](https://reposit.haw-hamburg.de/bitstream/20.500.12738/14214/1/Bachelorarbeit_Karolina%20Brack_Final_geschw%C3%A4rzt.pdf),
  printed pages 11-12, equations 13-16, reproduces the natural-ventilation subset
  and cites DIN EN / DIN/TS 12831. This is a published secondary worked source,
  not a complete licensed copy of the standard or proof of all UK scheme requirements.
- [h2x technical article](https://www.h2xengineering.com/blogs/bs-en-12831-1-2017-heat-loss-calculation-standard/),
  Table B.8 image and published zone heat-loss equation, accessed directly.
- [MCS room and airtightness values](https://heatloadcalculator.mcscertified.com/docs/reference-sources/ventilation-rates):
  default q50 12 m3/(h.m2), minimum 0.5 ACH with zero for an internal room without envelope.
- [MCS additive bridging](https://heatloadcalculator.mcscertified.com/docs/reference-sources/thermal-bridging).
- [CIBSE Domestic Heating Design Guide 2026 internal floor and ceiling values](https://heatloss.elmhurstenergy.co.uk/docs/reference-sources/u-values)
  (Table 2-45: uninsulated intermediate floor 1.73 W/m²K upward, 1.41 downward;
  100 mm insulated 0.32 upward, 0.31 downward). The same page carries the
  internal-wall Table 2-36 and internal-door Table 2-42 values the survey already
  uses, and states that internal floor, ceiling, wall and door U-values affect the
  individual room heat loads and not the total property heat loss.

## Multi-storey zones and inter-storey boundaries

A captured two-storey Heat Engineer case (two stacked 4 x 3 m rooms, Lounge 21 °C
ground floor, Kitchen 18 °C first floor, one storey per room, detached, normal
shielding, q50 12) confirms the same method across storeys:

```
zoneInfiltration = q50 * whole-zone external envelope area * TableB.8 coefficient
```

The zone envelope is limited to externally exposed surfaces: the intermediate floor
and ceiling are excluded, so the first-floor room contributes walls plus roof and the
ground-floor room walls plus ground floor. The zone height used for the Table B.8
band is the whole-zone height, not one room's. At two storeys of 2.4 m the band and
coefficient are unchanged from a single storey (0.05 at normal shielding), so the
storey count does not move the ventilation figure until the zone passes 10 m.

The intermediate floor between two heated rooms is one signed element per room, and
the vendor resolves it at 1.73 W/m²K with the INTERNAL bridging allowance, which is
CIBSE DHDG 2026 Table 2-45's uninsulated intermediate floor value for upward heat
flow. An isolated vendor experiment confirms the allowance: replacing the
intermediate construction with the project's 0.32 W/m²K roof returned 15.12 W for
12 m² at 3 K, which is (0.32 + 0.10) x 12 x 3; an external allowance would have
returned 16.92 W. Every element, both room ventilation flows, both room emitter
demands and the building total reproduce to 0.01 W with matched inputs.

The two sides are equal and opposite, so the interface splits the room emitter
demands by ±65.88 W in that case and leaves the building demand and the zone
ventilation unchanged. This is why the reference check keeps inter-storey terms as
signed room transfers that are excluded from the building fabric sum.

### Explicit shared records (geometry method `explicit-interstorey-v1`)

The heated-boundary selectors no longer imply the neighbouring room, insulation
or overlap area. In the existing Floor, ceiling and evidence section the upper
room records each interface once: actual room below, measured shared area (m²),
and `Uninsulated` or evidenced `100mm insulation` using Table 2-45. The lower
room reads the same record. Both current room temperatures select one physical
heat-flow direction and one U-value for both signed sides.

Multiple neighbours and three-storey chains are supported. Cycles, duplicate or
dangling links, missing construction, overlaps beyond either room, accumulated
areas beyond a surface and links exceeding the recorded storey depth fail closed.
No shared area is inferred from a smaller footprint.

Partial overlaps leave a derived unshared area. Its exposed construction must be
recorded in the conditional unshared-floor/ceiling choice. It enters both external
fabric and the infiltration envelope; it cannot disappear. These choices currently
support exposed floors and flat/loft ceilings, not arbitrary unheated spaces or slopes.

Schema 4 preserves the old boiler inputs and flags old implicit interfaces instead of inventing measurements. The interface migration itself did not change the calculation-data version; the later emitter-data review advances that version separately. Save/reload/import retain one
canonical `hl_interstorey_interfaces` list. An incomplete record prevents only the
reference check, not the ordinary boiler calculation.

Zone height remains an **estimate from storeys and mean recorded room height**,
labelled that way in screen/print, not a measured whole-building height. `4+` is
unresolved because it does not state a height. Mechanical systems, ventilation
devices, single-facade cases and equipment selection remain outside scope.

For balanced natural ventilation without mechanical supply/extract, combustion
openings or air terminal devices:

```
zoneInfiltration = q50 * zoneEnvelopeArea * TableB8Coefficient
roomLeakage = zoneInfiltration * roomEnvelopeArea / zoneEnvelopeArea
roomPeakInfiltration = min(zoneInfiltration, roomLeakage * directionFactor)
roomOutdoorFlow = max(roomPeakInfiltration, roomMinimumFlow)
zoneOutdoorContribution = max(roomLeakage, roomToZoneCoefficient * roomMinimumFlow)
roomVentilationW = 0.34 * roomOutdoorFlow * (roomTemperature - outdoorTemperature)
zoneVentilationW = 0.34 * zoneOutdoorContribution * (roomTemperature - outdoorTemperature)
```

The direction factor is explicit and required by the pure API. A value of 2 is
published in the natural worked source and independently reproduces the tested
multi-facade commercial fixtures; the UI refuses a single-facade case because it
has not been benchmarked here. The room-to-zone coefficient is 1 for a one-room
zone, 0.5 for a multi-room zone. It acts inside the maximum expression, not as a
blanket reduction of the room ventilation or the complete load.

Table B.8's 0.09 elevated-zone cell covers multiple facades with zone height up to
20 m. The single-facade row and the >20 m column retain their own coefficients;
a regression corrects the earlier blanket override.

## Independent commercial fixtures

`test/fixtures/heat-engineer-reference.json` freezes actual Heat Engineer 2026
outputs for five synthetic cases: normal/intensive/no shielding, unequal rooms,
and Lounge 21 C / Kitchen 18 C. It contains no login data, real property address
or external project IDs. Expected outputs are never regenerated from our implementation.

With matched geometry, material U-values, bridging and temperatures, the corrected
reference route gives the same room components, room demand and building demand.
The unequal-room case specifically distinguishes the cap from the previous
volume-share model: flows must be 47.52 and 34.56 m3/h, not 63.36 and 31.68.

The fresh vendor retest with Lounge 21 C / Kitchen 18 C gives building demand
2353.79904 W and summed emitter demand 2810.30208 W. This is a controlled test,
not the surveyed property at the address behind the vendor project.

`test/fixtures/heat-engineer-multifloor.json` freezes the two-storey capture: the
whole-zone infiltration flow 56.82 m³/h over a 94.7 m² zone envelope, per-room
leakage 29.46 and 27.36 m³/h, capped room flows 56.82 and 54.72 m³/h, room
ventilation 457.85556 and 385.11936 W, zone ventilation 237.38868 and 192.55968 W,
every fabric element, both room emitter demands (1602.84756 and 1179.53136 W), the
building demand 2369.35236 W and the summed emitter demand 2782.37892 W. It stores
the vendor's resolved inputs, so a failure can only be a method difference.

## Scope gates, not hidden approximations

The pure natural module rejects mechanical systems, nonzero or malformed device
flows, missing geometry, duplicate rooms, invalid temperatures and a missing
room direction factor. The current UI comparison is narrower: complete recorded
rooms, one to three recorded storeys (the menu's `4+` is unresolved), standard or measured-q50 airtightness, automatic room rate,
natural ventilation, no additional vents/flues, more than one exposed facade and
explicit measured shared records and recorded exposed remainders. It displays a reason instead of a number
for unsupported cases. Nothing blocks the ordinary boiler workflow.

Remaining work includes mechanical/ATD/combustion and air-transfer pressure terms,
the design-ACH UI path, insulation other than the published 100 mm preset,
arbitrary unheated remainders, measured zone-height geometry, additional boundary
cases and complete method validation before equipment sizing.

## Measured q50 evidence extension

The existing `Measured 50 Pa permeability` evidence selector and value now feed the
experimental natural check. A finite, positive recorded q50 replaces the standard
12 in the same published infiltration equation. Missing or invalid evidence refuses
the check; it never silently becomes 12. Returning to `Standard default` ignores a
stale measured value. The printed basis identifies measured q50 and asks the designer
to verify that the air test covers the same ventilation zone. The recorded air-test
area/volume do not replace the survey's explicit geometry or allocate hidden leakage.

The MCS ventilation reference states that the 12 default applies when neither measured
permeability nor a justified design ACH is known. This extension uses the already
implemented q50 input, not a new pressure-conversion rule. Browser longhand checks at
q50 6 and 18 independently verify envelope allocation, room/zone maxima and ventilation
watts, and prove the entire legacy result object is unchanged. The existing commercial
fixtures are q50 12; **these new measured cases are not new commercial captures**.
The design-ACH route, mechanical ventilation and devices still fail closed. Equipment
sizing remains disabled. See `test/browser/reference-measured-q50.spec.js`.

## Verification

- Write a failing regression before each implementation change; RED was observed
  for the room/zone route, aggregate composition, exposure boundary and DOM integration.
  Multi-storey support was red-proved in a disposable copy of the checkout: all three
  browser cases failed there against the previous revision with the old
  `single-storey zone only` message, and pass in the checkout that carries the fix.
- Run `npm test`, `npm run check`, the complete Playwright suite and `git diff --check`.
- Before/after browser captures of the real form at Lounge 21 C / Kitchen 18 C
  must have zero changed numeric legacy fields. Do not use a passing test count as
  substitute for this comparison.
- Schema 4 migrates the data shape only; the legacy calculation-method version remains 3.
- Three-storey, insulation and partial-overlap UI fixtures use independent longhand expectations. The retained independent commercial capture is two-storey; do not describe the three-storey UI test as a fresh vendor benchmark.
- A future switch of equipment-sizing numbers must version and review saved surveys.
