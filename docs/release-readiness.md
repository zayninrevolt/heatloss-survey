# Local release readiness and standards-reference queue

## Release scope

This local release bundles the already approved PDF pagination, overlap-only build-year and 45-75 degree radiator choices with a manufacturer-data review and a mixed two-storey regression. Nothing here authorises a push or deployment.

The boiler/radiator workflow still uses the workbook-style heat-loss method. Building design demand, room emitter demand, selected radiator capacity and the boiler/range-rate recommendation are distinct quantities. The PDF now states the existing range-rate rule accurately: the larger of 12 kW and 110% of corrected selected radiator capacity. That recommendation is not a heat-pump size.

Emitter selection changes intentionally: Myson model ratings/dimensions are corrected and the fitted temperature exponent is replaced by bounded interpolation of published data. Unsupported Myson operating points are refused; existing sizes are retained for evidence review. See [manufacturer validation](emitter-manufacturer-validation.md). Schema remains 4; calculation-data version advances to 4 so older surveys receive a review prompt. A future calculation-method stamp is rejected without replacing the current survey.

## Synthetic whole-survey acceptance test

`test/browser/realistic-two-storey.spec.js` exercises seven rooms over two storeys: lounge, kitchen, hallway, two bedrooms, bathroom and landing. It mixes suspended and solid ground floors, upgraded and older walls/windows, two loft-insulation levels, room temperatures, standard internal doors, existing radiators and 45/35 design temperatures. A 1997 build date resolves the overlapping age band without changing recorded constructions.

Each room's fabric, ventilation, bridging, total and building contribution is compared with independent arithmetic using the fixture's declared dimensions, U-values and rates. Shared inter-storey terms balance. The test reloads, downloads and reimports the actual JSON backup, then exports a real PDF through the app's Save PDFs menu. It checks every room, the recorded year, temperature basis, pagination and a phone-width hallway screenshot.

This is representative workflow verification, not a real measured property. The hallway/stair footprint and landing are recorded per storey using the existing rectangular-room convention. Open stairwell voids, sloping surfaces and arbitrary 3D scan geometry have not been validated by this fixture.

## Standards-reference progress and gates

The [official MCS ventilation reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/ventilation-rates), checked 15 October 2026, distinguishes measured permeability/design ACH from the default q50 12, lists room minima from CIBSE DHDG 2026 Table 2-18, and lists mechanical/device defaults from SAP 10.2. These published tables alone are not the complete pressure-flow or heat-recovery combination algorithm.

Completed in this release: the experimental check consumes the existing measured-q50 field; independent checks at 6 and 18 verify the same sourced infiltration equation and room/zone allocation. Invalid measurement evidence refuses the check. Switching back to the standard route ignores a stale measurement. Legacy boiler results stay unchanged; equipment sizing is still disabled.

Next evidence-led work, in order:

1. Obtain an independent measured-q50 commercial capture with matched geometry and the same ventilation zone. The new measured UI cases currently have longhand checks, not new commercial captures.
2. Establish complete mechanical supply/extract/heat-recovery, ATD and combustion equations, including pressure imbalance and air-transfer terms. Then freeze independent matched-input fixtures before enabling each route. Do not apply heat recovery to infiltration or import the old experimental v1 helper into the live v2 route merely to fill a gap.
3. Validate justified design ACH and single-facade cases independently. Do not invent a direction factor or conversion to q50.
4. Resolve measured whole-zone height, more insulation constructions and unheated partial-overlap remainders with authoritative inputs and geometry checks. Do not infer shared areas from room footprints or add the vendor's unsourced perimeter allowance.
5. Validate ground-contact heat transfer to the applicable BS EN ISO 13370 approach before claiming that scope. The current fixed construction U-values are survey assumptions, not that full ground model.
6. Only after whole-method independent validation, plan a separately approved/versioned equipment-sizing transition. Never silently switch old boiler surveys, and do not call the app accredited or fully MCS/BS EN 12831 compliant.

Mechanical systems, additional devices, design ACH, single-facade and unsupported geometry still show explicit unavailable reasons. No speculative implementation is part of this release.

## Management and release route

Source, tests and evidence documentation remain in the existing Git checkout. Normal maintenance is through a working branch, tests, review and a local commit. Use `npm test`, `npm run check`, `npm run test:browser` and `git diff --check`; the installed-browser override for this server is stored with the private execution receipt. No new service, dependency, container, port exposure or external account is required.

Before an approved release, export any live browser survey to JSON, verify the branch is a fast-forward of current remote main and that only approved commits are included. Push only after separate approval; verify the remote commit, all CI checks and live asset cache versions. `scripts/verify_release.py` is the existing CI/live-token management helper. Rollback should revert the reviewed release commit on a clean branch and rerun the same gates; do not reset away saved surveys or unrelated work. Local receipt files and screenshots are outside the published repository.
