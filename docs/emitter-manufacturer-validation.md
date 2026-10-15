# Myson fan-convector manufacturer-data review

## Evidence and intended use

Source: [Myson Complete Heating Solutions, February 2025, fan convectors](https://www.myson.co.uk/media/23hlaofg/fan-convectors.pdf), printed pages 147-149 and 153-155, checked 15 October 2026. The [current Kickspace product page](https://www.myson.co.uk/products/28573/kickspace/) corroborates model identities. These are public manufacturer data, not private commercial benchmark assets.

The normal-fan heat outputs are quoted at 340 litre/hour water flow. The app uses the published delta-T30 and delta-T50 points. At intermediate temperatures it uses explicitly documented **linear interpolation**, not a claimed manufacturer temperature exponent. The factor 1.06 in the Hi-Line table corrects water flow to 455 litre/hour; it is NOT a temperature exponent. The old generalised exponent has been removed.

| Model | Normal output at delta-T30 (W) | Normal output at delta-T50 (W) |
| --- | ---: | ---: |
| Kickspace 500 | 566 | 896 |
| Kickspace 600 | 729 | 1278 |
| Kickspace 800 | 1077 | 1707 |
| Hi-Line RC 7-4 | 541 | 930 |
| Hi-Line RC 10-6 | 937 | 1610 |
| Hi-Line RC 15-10 | 1431 | 2459 |
| Hi-Line RC 20-14 | 2018 | 3468 |
| Hi-Line LV 7-4 | 541 | 930 |

The old 755/1023 W Kickspace 500/600 ratings were actually the 80S/80D ratings. The 600/800 widths are corrected to 550/603 mm from the brochure technical drawings. The current product overview rounds the 800 length to 600 mm; the app conservatively uses the 603 mm technical dimension. Never relabel an 80S/80D as a 500/600.

## Operating limits and conservative selection

The brochure explains that the water sensor enables/stops the fan. A temperature correction alone does not demonstrate that a unit will start or run continuously. Therefore automatic Myson options are refused **outside delta-T30 to delta-T50**. In particular, a 45/35 design is not validated by these data and is not automatically offered. This is a conservative application scope limit, not a claim that every Myson product is incapable of low-temperature operation.

Confirm the actual product, its fan-start sensor/configuration, delivered water flow, fan speed, mounting and installation conditions. No low-limit kit, modified thermostat or numeric switching threshold is assumed. Installation manuals on retailer and manufacturer download hosts could not be reliably extracted in this review, so no unverified threshold has entered the code. For a supported low-temperature product with independently obtained output, record that output and its design basis through the existing custom-output route. No new product range has been invented or added.

The app's recorded installation/connection factors remain applied after the nominal manufacturer output, separately from heat-loss demand. Bathroom filtering is retained: only the low-voltage Hi-Line LV is offered there from this catalogue. This filter does not replace electrical-zone, IP-rating or installation checks.

## Saved surveys and verification

Previously recorded model names and temperatures are retained. Out-of-scope recorded Myson sizes show an explicit manufacturer-output review instead of an invented output or a false adequacy result. Inactive second-emitter metadata does not trigger the review.

Calculation-data version 4 adds a restored-survey review because corrected emitter data may change radiator adequacy and the derived boiler range-rate recommendation. Current JSON exports carry the calculation-method stamp as well as the schema stamp, so freshly exported surveys do not generate false historical-review warnings on re-import. Schema remains 4; the legacy room/building heat-loss method and `legacy-boiler-v1` route remain unchanged. Current-schema files also receive version review, independently of schema migration; a future calculation-method stamp is refused rather than silently downgraded.

Tests: `test/myson-fan-convectors.test.js`, `test/release-boundaries.test.js`, and `test/browser/myson-manufacturer-data.spec.js`. Final run receipts are stored outside the checkout under `/opt/data/heatloss-benchmarks/release-review-20261015/`.
