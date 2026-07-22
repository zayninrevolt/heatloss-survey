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

The Heat Loss PDF includes a second assumptions page listing the selected wall, window, door, floor and loft construction for every completed room, together with each U-value, property and extension age, evidence quality, thermal-bridge factor, ventilation device, air-change rate and property ventilation system used in the calculation.

Room ventilation defaults follow the MCS/CIBSE minimum of 0.5 air changes per hour for a heated room with an external envelope and 0 ACH for a fully internal room. A room can instead use a manual ACH override, or a verified whole-property design ACH can raise the exposed-room minimum. Measured air permeability and its evidence source can also be recorded. Extract fans, passive vents, fires, flues and chimneys add their published default airflow. The property can use natural ventilation, MEV, MV, MVHR or PIV; MVHR applies the entered heat-recovery efficiency and PIV distributes its 20 m³/h supply across entered rooms by volume.

The property postcode automatically selects the nearest MCS/CIBSE reference weather station and its 99.6% outdoor design temperature. The same postcode coordinates are used to estimate property altitude through Elevation API EU and Copernicus terrain data. The app applies the MCS correction of 0.6°C per complete 100m above the design reference station. It also selects the MCS annual mean temperature from the nearest climate station as the ground temperature for solid floors. All three values remain editable. Postcode coordinates are retrieved from the public postcodes.io service; no other survey details are sent.

Technical U-value entry is replaced with plain construction choices. These include single brick or stud and plasterboard internal walls, single or double glazing, and plasterboard loft ceilings with no insulation or 50mm, 100mm or 200mm insulation. The standard value is applied automatically behind each choice. Property-wide defaults apply external wall, internal wall and window choices. Floor, ceiling or loft construction and ventilation devices must be selected inside each room so different floors and room conditions can be treated correctly.

Simple mode keeps the normal survey short. Detailed mode adds a second external-wall construction, extension or room-in-roof age, measured window and door dimensions, ground-floor exposed perimeter, known temperatures below floors, adjacent-space categories, airtightness evidence and radiator space filters. Mixed external walls are calculated using a length-weighted U-value. Measured opening dimensions override the simple entered area.

Internal walls can be marked as adjoining a heated room or an unheated space. A heated wall uses the difference between the current room and the selected adjoining room for radiator sizing, while that internal transfer is excluded from the whole-property heat loss. Unheated options include garages, cellars, cupboards, corridors, conservatories, roof voids, neighbouring dwellings and outside air. A known adjacent temperature overrides the standard factor.

The property age uses the current England and Wales RdSAP age bands A to M. The normal public EPC certificate does not display the stored construction-age field. The separate GOV.UK developer dataset contains a construction-age band, but requires GOV.UK One Login and an authenticated API workflow, so a static GitHub Pages app cannot import it securely. The app links to that data service and otherwise accepts title deeds, council building-control records, homeowner information, a visual estimate or Unknown. Unknown remains valid when no reliable record is available. Age bands also apply the current MCS default room temperatures: bands A to J use room-specific 18°C, 21°C or 22°C values, while band K onwards uses 21°C throughout except bathrooms and shower rooms at 22°C.

## Stelrad Elite sizing

Every completed room provides a dropdown of suitable Stelrad Elite radiators. Sizes use the format `600(h) x 1200(w) K2`, with the smallest suitable 600mm-high K2 selected by default where available. Detailed filters can limit maximum height, maximum width and panel type, or prioritise the existing radiator width. A room can use one radiator, two matching radiators, or automatic mode, which tries one first and then two when no single filtered model works. Each listed selection meets the room requirement without exceeding it by more than 50%. The selected model and its total temperature-corrected output are saved with the survey.

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
- [GOV.UK energy performance data service](https://get-energy-performance-data.epb-integration.digital.communities.gov.uk/)
- [Elevation API EU](https://www.elevation-api.eu/)
- [Met Office weather-station locations](https://www.metoffice.gov.uk/research/climate/maps-and-data/uk-synoptic-and-climate-stations)

Construction choices are practical survey starting points and must be checked against the property. The app does not claim to be a certified MCS or BS EN 12831 design tool.

## Running the app

Open `index.html` in a browser. All survey data is stored locally in that browser, with JSON export available for portable backups.

Based on the original project: https://github.com/zayninrevolt/survey
