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

Room ventilation defaults use the selected property age band and room type, using the requested pre-1996, 1996-2002 and 2003-onwards MCS/CIBSE minimum ACH table. Fully internal rooms use 0 ACH. A room can instead use a manual ACH override. Extract fans, passive vents, fires, flues and chimneys add their published default airflow. The property can use natural ventilation, MEV, MV, MVHR or PIV; MVHR applies the entered heat-recovery efficiency and PIV distributes its 20 m³/h supply across entered rooms by volume. Radiator sizing defaults to BBOE, which applies a 0.96 factor to each radiator’s temperature-corrected output. This 4% emitter-output reduction does not change the calculated room or building heat loss. TBOE can be selected when applicable.

The property postcode automatically selects the nearest MCS/CIBSE reference weather station and its 99.6% outdoor design temperature. The same postcode coordinates are used to estimate property altitude through Elevation API EU and Copernicus terrain data. The app applies the MCS correction of 0.6°C per complete 100m above the design reference station. It also selects the MCS annual mean temperature from the nearest climate station as the ground temperature for solid floors. All three values remain editable. Postcode coordinates are retrieved from the public postcodes.io service; no other survey details are sent.

Technical U-value entry is replaced with a small set of practical construction choices. The wall list includes two DHDG open-cavity presets for a brick outer leaf, air gap, aerated-block inner leaf and 13mm plaster: 100mm inner block at U=0.87 and 125mm inner block at U=0.77. It also includes single brick or stud and plasterboard internal walls, single or double glazing, and plasterboard loft ceilings with no insulation or 50mm, 100mm or 200mm insulation. A small number of worked DHDG reference presets are included for an uninsulated solid ground floor (U=0.85) and a flat roof with 200mm insulation (U=0.17). Property-wide defaults apply external wall, internal wall and window choices. Floor, ceiling or loft construction and ventilation devices must be selected inside each room so different floors and room conditions can be treated correctly.

The survey uses one streamlined flow without a separate detailed mode. Each room shows an explicit number of internal walls, initially estimated as four minus the outside-wall count. Every visible wall row asks for its measured length and provides a DHDG temperature dropdown for the other side: 10°C unheated or party-wall assumption, 18°C functional room, 21°C living space, 22°C bathroom or shower room, or 23°C vulnerable-person living temperature. One internal-wall construction is selected for those rows, and each wall uses its own signed room-to-adjoining temperature difference. Loss to a 10°C unheated boundary remains in the property total; transfers between heated rooms are excluded from the property total to avoid double counting.

For a rectangular room, the app estimates the exposed-wall length from the outside-wall count when no measured exposed length is entered. It then shows the remaining perimeter for checking the combined internal-wall measurements. The wall count can be changed for irregular rooms.

The property age uses the current England and Wales RdSAP age bands A to M. There is no property-age lookup in the app. The surveyor can search separately using title deeds, council building-control records, homeowner information or another reliable property record. Unknown remains valid when no reliable record is available. Room temperatures use three clear defaults: bathrooms and shower rooms 22°C, living rooms and lounges 21°C, and all other rooms 18°C.

Boundary temperatures follow the DHDG construction rule automatically. Solid ground floors use the property ground-reference temperature. Suspended timber and exposed floors use the outdoor design temperature. Roof and loft constructions also use the outdoor design temperature because the loft-space effect is already included in the selected U-value. Heated-room-above and heated-room-below choices do not add an external fabric loss.

## Stelrad Elite sizing

Every completed room provides a dropdown of suitable Stelrad Elite radiators. The room form keeps Heat loss details first and then presents one contiguous radiator assessment and selection panel containing the outcome, required output, existing radiator size and location, and replacement controls. Sizes use the format `600(h) x 1200(w) K2`, with the smallest suitable 600mm-high K2 selected by default where available. The dropdown includes the suitable heights, widths and panel types. A room can use one radiator or two independently selected radiators, so the height, width and panel type can differ. Automatic mode tries one first and then two when no single model works. Every single selection or two-radiator combination meets the room requirement without exceeding it by more than 50%. Both selected models and their combined temperature-corrected output are saved with the survey.

The front-page range-rate output is a minimum of 12 kW. When the combined temperature-corrected output of the selected room radiators exceeds 12 kW, the higher combined figure is used instead.

The listed Elite heights are:

- K1 and K2: 300mm, 450mm, 600mm and 700mm
- K3: 300mm, 500mm, 600mm and 700mm

The app uses Stelrad's published ΔT50 output for each height and panel type, then applies Stelrad's correction factor using mean water temperature minus room temperature. The radiator temperature selector is limited to 75°C nominal ΔT50, 65°C nominal ΔT40 and 55°C nominal ΔT30. These use 75/65, 65/55 and 55/45°C flow and return pairs respectively.

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

Construction choices are practical survey starting points and must be checked against the property. The app does not claim to be a certified MCS or BS EN 12831 design tool.

## Running the app

Open `index.html` in a browser. All survey data is stored locally in that browser, with JSON export available for portable backups.

## Architecture and verification

Technical logic is being separated from the legacy single-page UI into dependency-free modules under `src/`. These modules work as browser globals and as CommonJS modules, so the exact calculation code used by the survey can be tested with Node without adding a production build step.

- `src/heat-loss.js` — geometry, fabric, ventilation, floor-temperature and altitude calculations
- `src/radiator-sizing.js` — correction factors, radiator output and single/two-radiator selection
- `src/persistence.js` — schema-versioned encoding and ordered migrations for saved surveys
- `src/validation.js` — non-blocking physical-range checks

Run `npm test` for table-driven unit tests and `npm run check` for JavaScript syntax checks. After installing development dependencies and Chromium with `npx playwright install chromium`, run `npm run test:browser` for save/restore, JSON export, failed-postcode and print smoke tests. GitHub Actions runs these checks for pushes and pull requests.

The unit fixtures include hand-calculated component loads using `U-value × area × temperature difference`, ventilation using `0.33 × airflow × temperature difference`, ground-floor temperature differences, complete-100m altitude corrections, ΔT50 radiator output scaling, the 50% oversize boundary, and two-radiator selection. They are regression evidence, not independent MCS certification. The construction assumptions and manufacturer data still require checking against the cited MCS and Stelrad publications before use on a live design.

Based on the original project: https://github.com/zayninrevolt/survey
