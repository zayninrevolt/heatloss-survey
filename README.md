# Heatloss Survey

A self-contained heating survey web app with room-by-room heat-loss calculations, radiator scheduling, survey storage and printable reports.

## Heat-loss calculation

Heat loss is built into the Rads page. Each room has a Heat loss details dropdown, while the room length, room width and shared ceiling height are reused from the radiator survey.

For each room, the app calculates:

- Fabric loss from exposed walls, windows, doors, floors and roofs using `U-value × area × temperature difference`
- Ventilation loss using `0.33 × heat-loss airflow in m³/h × temperature difference`
- A legacy percentage or age-based RdSAP thermal-bridge allowance
- Total watts, kilowatts and watts per square metre
- Ground-floor loss using a separate ground temperature, rather than the outdoor air temperature
- Heated internal-wall transfer using the selected adjoining room temperature

Calculated room loads feed the existing radiator schedule automatically. The Front, Rads and Heat Loss sheets can be printed together.

The Heat Loss PDF includes a second assumptions page listing the selected wall, window, door, floor and loft construction for every completed room, together with each U-value, property age, evidence quality, thermal-bridge factor, ventilation device, air-change rate and property ventilation system used in the calculation.

Room ventilation currently uses the legacy workbook-style room table, with named pre-2000, 2000-2006 and 2006+ categories. Automatic mapping uses A-H, I-J and K-M respectively. A conditional **Year built** field appears only for the overlapping I/J bands when no explicit ventilation category is selected. A valid year resolves the pre-2000 cutoff; blank or invalid years retain the existing result with a provisional review warning. The source labels overlap at 2006, so that year requires an explicit category confirmation rather than a guessed cutoff. Recorded constructions and manual overrides are preserved. See [the source, boundary rules and saved-survey compatibility](docs/build-year-ventilation.md). This is not the current MCS infiltration and mechanical-ventilation method. Fully internal rooms use 0 ACH. A room can instead use a manual ACH override. Extract fans, passive vents, fires, flues and chimneys add their published default airflow. The property can use natural ventilation, MEV, MV, MVHR or PIV; MVHR applies the entered heat-recovery efficiency and PIV distributes its 20 m³/h supply across entered rooms by volume. Radiator sizing defaults to BBOE, which applies a 0.96 factor to each radiator’s temperature-corrected output. This 4% emitter-output reduction does not change the calculated room or building heat loss. TBOE can be selected when applicable.

The property postcode automatically selects the nearest MCS/CIBSE reference weather station and its 99.6% outdoor design temperature. The same postcode coordinates are used to estimate property altitude through Elevation API EU and Copernicus terrain data. The app applies the MCS correction of 0.6°C per complete 100m above the design reference station. It also selects the MCS annual mean temperature from the nearest climate station as the ground temperature for solid floors. All three values remain editable. Postcode coordinates are retrieved from the public postcodes.io service; no other survey details are sent.

Technical U-value entry is replaced with a small set of practical construction choices. The wall list includes two DHDG open-cavity presets for a brick outer leaf, air gap, aerated-block inner leaf and 13mm plaster: 100mm inner block at U=0.87 and 125mm inner block at U=0.77. It also includes single brick or stud and plasterboard internal walls, a plywood-faced hollow-core internal-door survey default at 2.0 W/m²K, CIBSE DHDG Table 2-42 solid-wood and glazed internal-door choices, RdSAP Table 24 external-window and roof-window choices, and plasterboard loft ceilings with no insulation or 50mm, 100mm or 200mm insulation. The plywood-faced value is a manufacturer-doorset benchmark, not an MCS/CIBSE generic lookup, so a known manufacturer/design value can be recorded where evidence is available. A small number of worked DHDG reference presets are included for an uninsulated solid ground floor (U=0.85) and a flat roof with 200mm insulation (U=0.17). External doors follow RdSAP 10 Table 26: 3.0 W/m²K in age bands A to J, 2.0 in K, 1.8 in L for England, Wales and Northern Ireland (1.6 in Scotland), 1.4 in M, and 1.4 to an unheated corridor or stairwell. A door only counts as insulated with documentary evidence of its U-value, and a door with 60% or more glazing is recorded as a window rather than as a door. Window and roof-window selections give the documented whole-opening U-value, including PVC or wood frame, glazing gap and installation period. Property-wide defaults apply external wall, internal wall and window choices. The internal-door construction is a property-wide choice. Floor, ceiling or loft construction and ventilation devices must be selected inside each room so different floors and room conditions can be treated correctly.

The survey uses one streamlined flow without a separate detailed mode. Each room shows an explicit number of internal walls, initially estimated as four minus the outside-wall count. Every visible wall row asks for its measured length and provides a DHDG temperature dropdown for the other side: 10°C unheated or party-wall assumption, 18°C functional room, 21°C living space, 22°C bathroom or shower room, or 23°C vulnerable-person living temperature. One internal-wall construction is selected for those rows, and each wall uses its own signed room-to-adjoining temperature difference. Each room also records the number of standard internal doors. Every door is modelled as 762mm × 1981mm, or 1.51m², removed proportionally from the internal-wall area and re-added using the selected property-wide internal-door U-value at the same weighted boundary temperature. Loss to a 10°C unheated boundary remains in the property total; transfers between heated rooms are excluded from the property total to avoid double counting.

For a rectangular room, the app estimates the exposed-wall length from the outside-wall count when no measured exposed length is entered. It then shows the remaining perimeter for checking the combined internal-wall measurements. The wall count can be changed for irregular rooms.

The property age uses the current England and Wales RdSAP age bands A to M. There is no property-age lookup in the app. The surveyor can search separately using title deeds, council building-control records, homeowner information or another reliable property record. Unknown remains valid when no reliable record is available. Room temperatures use three clear defaults: bathrooms and shower rooms 22°C, living rooms and lounges 21°C, and all other rooms 18°C.

Boundary temperatures follow the DHDG construction rule automatically. Solid ground floors use the property ground-reference temperature. Suspended timber and exposed floors use the outdoor design temperature. Roof and loft constructions also use the outdoor design temperature because the loft-space effect is already included in the selected U-value. Heated-room-above and heated-room-below choices do not add an external fabric loss.

## Stelrad Elite sizing

Every completed room provides a dropdown of suitable Stelrad Elite radiators. The room form keeps Heat loss details first and then presents one contiguous radiator assessment and selection panel containing the outcome, required output, existing radiator size and location, and replacement controls. Sizes use the format `600(h) x 1200(w) K2`, with the smallest suitable 600mm-high K2 selected by default where available. The dropdown includes the suitable heights, widths and panel types. Under **Assess the existing radiator**, an adequate radiator remains the no-replacement default and its recorded size remains selectable for a same-size replacement, while suitable catalogue replacements are also shown so the surveyor can choose a properly sized replacement. A room can use one radiator or two independently selected radiators, so the height, width and panel type can differ. Automatic mode tries one first and then two when no single model works. Normal single selections and two-radiator combinations meet the room requirement within a 50% oversize limit. For very small loads, the minimum-size radiator exception can exceed that limit; its actual oversize and a review warning appear in the room result and printed assumptions. Both selected models and their combined temperature-corrected output are saved with the survey.

The front-page boiler/range-rate recommendation is the higher of 12 kW or 110% of the combined temperature-corrected selected radiator output. It is an existing app rule, not a heat-pump selection rule or the building design heat loss.

The listed Elite heights are:

- K1 and K2: 300mm, 450mm, 600mm and 700mm
- K3: 300mm, 500mm, 600mm and 700mm

The app uses Stelrad's published ΔT50 output for each height and panel type, then applies Stelrad's correction factor using mean water temperature minus room temperature. The radiator flow temperature is selectable in 5°C steps from 45°C to 75°C; each option records a 10°C flow-to-return spread, so 75°C is 75/65 (nominal ΔT50), 65°C is 65/55 (nominal ΔT40) and 45°C is 45/35 in a 21°C room (a 19 K ΔT, nominally ΔT20). Stelrad's published correction table starts at ΔT20. Below that, the factor is derived with the same (ΔT/50)^1.3 output exponent that reproduces the published table, and both the on-screen room warning and the printed assumptions state that the emitter output is extrapolated and must be confirmed against the manufacturer data. A recorded existing radiator and a saved survey keep whatever design temperature they were stored with.

Technical references:

- [Stelrad Elite K1 and K2 technical data](https://www.stelrad.com/wp-content/uploads/2019/06/Elite-web-PDF.pdf)
- [Stelrad Elite K3 technical data](https://www.stelrad.com/wp-content/uploads/2020/10/Elite_-K3_Web.pdf)
- [Stelrad correction factors](https://www.stelrad.com/trade/stelrad-correction-factor/)
- [MCS design conditions](https://heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions)
- [MCS U-value reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/u-values)
- [MCS ventilation-rate reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/ventilation-rates)
- [MCS thermal-bridging reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/thermal-bridging)
- [Elevation API EU](https://www.elevation-api.eu/)
- [Met Office weather-station locations](https://www.metoffice.gov.uk/research/climate/maps-and-data/uk-synoptic-and-climate-stations)

The reference modules now provide a separately versioned **experimental natural-ventilation check**, benchmarked against five captured single-storey Heat Engineer cases plus a captured **two-storey** case, including Lounge 21°C / Kitchen 18°C and unequal room sizes. It combines per-element additive bridging with separate room and building ventilation flows, and it resolves the inter-storey boundary between two heated storeys with the CIBSE Domestic Heating Design Guide 2026 Table 2-45 internal floor and ceiling values. The check appears inside the collapsed Heat-pump design review and in the printed assumptions. It does not replace the legacy boiler calculation, change radiator selection or claim complete MCS / BS EN 12831 validation. The current UI scope is standard or recorded measured-q50 airtightness, natural ventilation without additional devices, one to three recorded storeys (the menu offers `4+`, which is unresolved), explicit measured shared-interface records, and described exposed remainders; unsupported inputs show an explicit reason rather than a guessed result. See [the method, evidence and remaining limits](docs/reference-natural-validation.md).

Shared interfaces are entered once in the upper room's existing Floor, ceiling and evidence section: actual room below, measured area and uninsulated or 100 mm insulated construction. The lower room reads the same record. Partial overlaps need the exposed remainder construction. Schema 4 preserves old boiler inputs and flags old implicit interfaces instead of inventing measurements. Three-storey UI/longhand regression coverage is distinct from the retained two-storey commercial capture.

## Fan-convector data and limits

Myson options use the public February 2025 manufacturer's normal-fan output tables at 340 litre/hour water flow. Corrected Kickspace 500/600/800 ΔT50 ratings are 896/1278/1707 W. The app interpolates linearly between published ΔT30 and ΔT50 points and does not offer automatic Myson selections outside that range. In particular it does not assume a standard fan-start sensor will work at a 45/35 design. Recorded sizes survive unsupported temperatures but require manufacturer-output review. See [manufacturer evidence and saved-survey behavior](docs/emitter-manufacturer-validation.md). Calculation-data version 4 prompts review of older emitter recommendations; it does not replace the workbook building heat-loss method.

## Running the app

Open `index.html` in a browser. All survey data is stored locally in that browser, with JSON export available for portable backups.

## JSON backups and legacy imports

Current JSON backups round-trip all built-in and custom-room fields through the browser download and file-picker controls. Imports accept both the app's flat JSON backup and a schema-versioned `{ schemaVersion, data }` envelope.

Older backups are migrated before the safety filter is applied. Renamed address, radiator-temperature and construction fields are converted to their current equivalents. An old aggregate internal-wall measurement is preserved as one numbered Wall 1 and clearly flagged for review; the app does not invent a split across several walls. Temperatures that already match 10°C, 18°C, 21°C, 22°C or 23°C are retained. Any other legacy wall temperature is left blank and named in the import review message so the surveyor must choose a standard value. Old manual floor and roof temperatures remain compatibility data only and cannot override the current ground/outdoor boundary rules. Backups created by a newer unsupported app schema are rejected without replacing the open survey.

## Architecture and verification

Technical logic is being separated from the legacy single-page UI into dependency-free modules under `src/`. These modules work as browser globals and as CommonJS modules, so the exact calculation code used by the survey can be tested with Node without adding a production build step.

- `src/heat-loss.js` — geometry, fabric, ventilation, floor-temperature and altitude calculations
- `src/radiator-sizing.js` — correction factors, radiator output and single/two-radiator selection
- `src/persistence.js` — schema-versioned encoding and ordered migrations for saved surveys
- `src/validation.js` — non-blocking physical-range checks
- `src/mcs-fabric.js` — MCS-reference element fabric loss, effective U-values and default thermal-bridging factors
- `src/mcs-ventilation.js` — the corrected natural-only v2 room/zone route uses Table B.8, envelope-area leakage allocation, the directional room cap and a 0.34 heat-capacity coefficient. Its older experimental v1 volume-share helpers remain for compatibility but are not used by the live reference check.
- `src/interstorey-interfaces.js` — validates a canonical shared-interface graph and creates reciprocal signed room elements.
- `src/interstorey-ui.js` — conditional upper-room editing, read-only lower-room projection and shared JSON persistence.
- `src/reference-natural-design.js` — composes reference fabric and natural ventilation into separately labelled building and emitter demands; equipment sizing stays disabled.

Saved surveys record two versions. The schema version describes the shape of the saved data. The calculation-method version describes what the numbers mean, so a survey saved before a calculation change loads with an on-screen notice telling the surveyor to recheck its results rather than silently returning different figures.

Run `npm test` for table-driven unit tests and `npm run check` for JavaScript syntax checks. After installing development dependencies and Chromium with `npx playwright install chromium`, run `npm run test:browser` for save/restore, JSON export, failed-postcode and print smoke tests. GitHub Actions runs these checks for pushes and pull requests.

The unit fixtures include hand-calculated component loads using `U-value × area × temperature difference`, ventilation using `0.33 × airflow × temperature difference`, ground-floor temperature differences, complete-100m altitude corrections, ΔT50 radiator output scaling, the 50% oversize boundary, and two-radiator selection. They are regression evidence, not independent MCS certification. The construction assumptions and manufacturer data still require checking against the cited MCS and Stelrad publications before use on a live design.

Based on the original project: https://github.com/zayninrevolt/survey
