# Heatloss Survey

A self-contained heating survey web app with room-by-room heat-loss calculations, radiator scheduling, survey storage and printable reports.

## Heat-loss calculation

Heat loss is built into the Rads page. Each room has a Heat loss details dropdown, while the room length, room width and shared ceiling height are reused from the radiator survey.

For each room, the app calculates:

- Fabric loss from exposed walls, windows, doors, floors and roofs using `U-value × area × temperature difference`
- Ventilation loss using `0.33 × air changes per hour × room volume × temperature difference`
- A configurable thermal-bridge allowance
- Total watts, kilowatts and watts per square metre
- Ground-floor loss using a separate ground temperature, rather than the outdoor air temperature
- Heated internal-wall transfer using the selected adjoining room temperature

Calculated room loads feed the existing radiator schedule automatically. The Front, Rads and Heat Loss sheets can be printed together.

The Heat Loss PDF includes a second assumptions page listing the selected wall, window, door, floor and loft construction for every completed room, together with each U-value and air-change rate used in the calculation.

The property postcode can automatically select the nearest MCS/CIBSE reference weather station and its 99.6% outdoor design temperature. An optional property altitude applies the MCS correction of 0.6°C per complete 100m above the reference station. The result remains editable. Postcode coordinates are retrieved from the public postcodes.io service; no other survey details are sent.

Technical U-value entry is replaced with plain construction choices. These include single brick or stud and plasterboard internal walls, single or double glazing, and plasterboard loft ceilings with no insulation or 50mm, 100mm or 200mm insulation. The standard value is applied automatically behind each choice. Property-wide construction defaults can be applied to all rooms and then adjusted room by room.

Internal walls can be marked as adjoining a heated room or an unheated space. A heated wall uses the difference between the current room and the selected adjoining room for radiator sizing, while that internal transfer is excluded from the whole-property heat loss. An unheated space uses half the indoor-to-outdoor temperature difference.

## Stelrad Elite sizing

Every completed room recommends the smallest suitable 600mm-high Stelrad Elite for the chosen K1, K2 or K3 panel type. Sizes use the format `600(h) x 1200(w) K2`. The app also shows the smallest suitable width for all three panel types.

Published outputs at 600mm height and ΔT50 are:

- K1: 1.000 kW per metre
- K2: 1.778 kW per metre
- K3: 2.514 kW per metre

At 1200mm wide this is 1.20 kW for K1, 2.13 kW for K2 and 3.02 kW for K3. The app multiplies these ratings by Stelrad's published correction factor using mean water temperature minus room temperature. The radiator temperature selector is limited to 75°C nominal ΔT50, 65°C nominal ΔT40 and 55°C nominal ΔT30. These use 75/65, 65/55 and 55/45°C flow and return pairs respectively.

Technical references:

- [Stelrad Elite K1 and K2 technical data](https://www.stelrad.com/wp-content/uploads/2015/04/21160_Elite_Web.pdf)
- [Stelrad Elite K3 technical data](https://www.stelrad.com/trade/wp-content/uploads/2020/10/28092_Elite_K3_Web-3.pdf)
- [Stelrad correction factors](https://www.stelrad.com/trade/stelrad-correction-factor/)
- [MCS design conditions](https://heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions)
- [MCS U-value reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/u-values)

Construction choices are practical survey starting points and must be checked against the property. The app does not claim to be a certified MCS or BS EN 12831 design tool.

## Running the app

Open `index.html` in a browser. All survey data is stored locally in that browser, with JSON export available for portable backups.

Based on the original project: https://github.com/zayninrevolt/survey
