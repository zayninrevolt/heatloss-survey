# Heatloss Survey

A self-contained heating survey web app with room-by-room heat-loss calculations, radiator scheduling, survey storage and printable reports.

## Heat-loss calculation

For each room, the app calculates:

- Fabric loss from exposed walls, windows, doors, floors and roofs using `U-value × area × temperature difference`
- Ventilation loss using `0.33 × air changes per hour × room volume × temperature difference`
- A configurable thermal-bridge allowance
- Total watts, kilowatts and watts per square metre

Calculated room loads feed the existing radiator schedule automatically. The Front, Rads and Heat Loss sheets can be printed together.

Construction presets are indicative survey starting points and can be overridden. The app does not claim to be a certified MCS or BS EN 12831 design tool.

## Running the app

Open `index.html` in a browser. All survey data is stored locally in that browser, with JSON export available for portable backups.

Based on the original project: https://github.com/zayninrevolt/survey
