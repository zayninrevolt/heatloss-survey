# Solid concrete ceilings between flats

## Published source

The [MCS Heat Load Calculator U-values reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/u-values#party-ceiling-types) publishes party-ceiling defaults derived from CIBSE Domestic Heating Design Guide (2026), Table 2-45. Its concrete slab entries are:

- No insulation: **1.82 W/m²K**.
- 100 mm insulation: **0.57 W/m²K**.

These are published generic party-ceiling defaults, not a U-value calculation for every possible slab thickness, finish, insulation material or build-up. Do not infer insulation from age alone or use the 100 mm choice without supporting evidence. They are distinct from the generic intermediate-floor timber/insulation values used by the experimental same-dwelling inter-storey comparison.

## Survey behaviour

Select either `Solid concrete ceiling to another flat, uninsulated` or `Solid concrete ceiling to another flat, 100mm insulation` under the room's **Ceiling or loft** control. Enter **Temperature in the flat above (°C)**, including a decimal where known. The field is blank initially and required for these options. Record the adjoining dwelling's design temperature or a justified unheated-space assumption; the app does not silently substitute the outdoor temperature or assume both dwellings have identical temperatures.

The ceiling's signed conduction is `U × room floor area × (room temperature - adjacent flat temperature)`. A warmer flat above can therefore produce a heat gain. With equal temperatures the conduction term is zero. Transfers to a separate dwelling remain in this survey's property total; they must not be cancelled as though both flats were rooms inside the same surveyed dwelling.

The existing legacy boiler-method allowances remain explicit: percentage bridging acts on the complete legacy load, including the ceiling transfer; age-based bridging remains an outdoor-envelope-area allowance, as for internal walls, and does not treat a party ceiling as outdoor roof area. The party ceiling alone does not count as an outdoor envelope surface for the automatic ventilation decision. This is not a newly validated BS EN 12831/MCS heat-pump sizing route.

Rooflights cannot be assigned beneath another flat. Switching back to a normal external roof hides and ignores the party-temperature field without deleting its recorded value. Existing roof, loft and heated-room-above choices keep their prior meaning. Saved surveys are not automatically changed to a concrete ceiling and the calculation-method version is unchanged.

The field and selection survive autosave, reload, JSON encode/decode/import and room duplication; the selected ceiling U-value and adjoining temperature appear in the printed assumptions. The experimental reference check explicitly reports party ceilings as unsupported instead of quietly treating them as outdoor roofs or inventing another surveyed room. Party constructions are excluded from its exposed remainder menus.

## Regression verification

- `test/browser/concrete-party-ceiling.spec.js` exercises required/invalid/zero/decimal temperatures, both published U-values, independent `U × A × delta-T` comparisons, cooler/equal/warmer adjacent flats, legacy bridge options, outdoor-envelope classification, save/reload/JSON round trip, printed assumptions, rooflight rejection and switching back to an external roof.
- `test/validation.test.js` exercises required finite adjacent temperatures and the party-ceiling rooflight boundary guard.
