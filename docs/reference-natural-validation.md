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
It derives inputs from the recorded rooms instead of adding new survey fields.
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

## Scope gates, not hidden approximations

The pure natural module rejects mechanical systems, nonzero or malformed device
flows, missing geometry, duplicate rooms, invalid temperatures and a missing
room direction factor. The current UI comparison is narrower: a complete recorded
single-storey zone, standard airtightness, automatic room rate, natural ventilation,
no additional vents/flues, and more than one exposed facade. It displays a reason
instead of a number for unsupported cases. Nothing blocks the ordinary boiler workflow.

Remaining work includes mechanical/ATD/combustion and air-transfer pressure terms,
measured/design-ACH UI paths, multi-storey exposed-envelope geometry, additional
boundary cases and complete method validation before equipment sizing.

## Verification

- Write a failing regression before each implementation change; RED was observed
  for the room/zone route, aggregate composition, exposure boundary and DOM integration.
- Run `npm test`, `npm run check`, the complete Playwright suite and `git diff --check`.
- Before/after browser captures of the real form at Lounge 21 C / Kitchen 18 C
  must have zero changed numeric legacy fields. Do not use a passing test count as
  substitute for this comparison.
- Calculation-method migration is intentionally unchanged: this update preserves
  every legacy figure and adds a separately identified reference comparison. A
  future switch of equipment-sizing numbers must version and review saved surveys.
