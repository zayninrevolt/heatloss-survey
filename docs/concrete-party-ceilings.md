# Solid concrete ceilings between flats

## Published construction source

The [MCS Heat Load Calculator U-values reference](https://heatloadcalculator.mcscertified.com/docs/reference-sources/u-values#party-ceiling-types) publishes party-ceiling defaults derived from CIBSE Domestic Heating Design Guide (2026), Table 2-45. Its concrete slab entries are:

- No insulation: **1.82 W/m²K**.
- 100 mm insulation: **0.57 W/m²K**.

These are generic party-ceiling defaults, not a U-value calculation for every slab thickness, finish or insulation build-up. Do not infer insulation from age alone or select 100 mm without evidence. They are distinct from the generic intermediate-floor values used by the experimental same-dwelling inter-storey comparison.

## Survey behaviour

Select either `Solid concrete ceiling to another flat, uninsulated` or `Solid concrete ceiling to another flat, 100mm insulation` under the room's **Ceiling or loft** control.

For this survey workflow, the flat above automatically uses a **fixed 10°C unheated-space design assumption**, as specified by Zayn. There is no extra temperature field. This is a stated design assumption, not a claim that the neighbouring dwelling is actually at 10°C. Do not replace it with outdoor temperature, the surveyed room temperature, or a value left over in an older hidden field.

The conduction is `U × room floor area × (room temperature - 10°C)`. Transfer to the separate dwelling remains in the surveyed property's load; it is not cancelled as an internal transfer between two rooms in the same survey.

The existing legacy boiler-method allowances remain explicit: percentage bridging acts on the complete legacy load, including the ceiling transfer; age-based bridging remains an outdoor-envelope-area allowance and does not treat a party ceiling as outdoor roof area. The party ceiling alone does not count as an outdoor envelope surface for the automatic ventilation decision. This is not a newly validated BS EN 12831/MCS heat-pump sizing route.

Rooflights cannot be assigned beneath another flat. Switching back to an ordinary roof restores its outdoor boundary rule. Existing loft and heated-room-above choices retain their meaning; saved surveys are not automatically changed to a concrete ceiling. The calculation-method version is unchanged because no existing construction is remapped and this option has not yet been published.

The ceiling selection survives autosave, reload, JSON import/export and room duplication. The printed assumptions show its construction and U-value plus `Adjacent flat: 10.0°C (unheated-space assumption)`. The experimental natural-reference check reports party ceilings as unsupported rather than treating them as outdoor roofs or inventing another surveyed room; party constructions are excluded from exposed-remainder menus.

## Regression verification

- `test/browser/concrete-party-ceiling.spec.js` checks the automatic fixed 10°C boundary without extra entry, ignores obsolete saved temperature keys, checks both published U-values against independent `U × A × (room - 10°C)` arithmetic, verifies legacy bridge and envelope treatment, save/reload/JSON round trip and printed assumptions, rejects rooflights, and switches back to an ordinary roof.
- `test/validation.test.js` checks finite party-boundary model inputs and rejects the party-ceiling/rooflight combination. The app supplies the fixed boundary value itself.
