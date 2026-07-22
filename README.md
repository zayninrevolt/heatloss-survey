# Heatloss Survey

A self-contained heating survey web app with room-by-room heat-loss calculations, radiator scheduling, survey storage and printable reports.

## Heat-loss calculation

Heat loss is built into the Rads page. Each room has a Heat loss details dropdown, while the room length, room width and shared ceiling height are reused from the radiator survey.

For each room, the app calculates:

- Fabric loss from exposed walls, windows, doors, floors and roofs using `U-value × area × temperature difference`
- Ventilation loss using `0.33 × air changes per hour × room volume × temperature difference`
- A configurable thermal-bridge allowance
- Total watts, kilowatts and watts per square metre

Calculated room loads feed the existing radiator schedule automatically. The Front, Rads and Heat Loss sheets can be printed together.

The Heat Loss PDF includes a second assumptions page listing the selected wall, window, door, floor and loft construction for every completed room, together with each U-value and air-change rate used in the calculation.

The property postcode can automatically select the nearest MCS/CIBSE reference weather station and its 99.6% outdoor design temperature. The result remains editable for manual site or altitude adjustments. Postcode coordinates are retrieved from the public postcodes.io service; no other survey details are sent.

Technical U-value entry is replaced with plain construction choices. These include single brick or stud and plasterboard internal walls, single or double glazing, and plasterboard loft ceilings with no insulation or 50mm, 100mm or 200mm insulation. The standard value is applied automatically behind each choice. Internal walls can be marked as adjoining a heated room, which records the construction but applies no heat loss, or an unheated space, which uses half the indoor-to-outdoor temperature difference.

Construction choices are practical survey starting points and must be checked against the property. The app does not claim to be a certified MCS or BS EN 12831 design tool.

## Running the app

Open `index.html` in a browser. All survey data is stored locally in that browser, with JSON export available for portable backups.

Based on the original project: https://github.com/zayninrevolt/survey
