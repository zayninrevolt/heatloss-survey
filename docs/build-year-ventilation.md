# Conditional build-year clarification for legacy ventilation

## Scope

The room-by-room boiler route uses the existing training-table ventilation categories.
This change refines the selected category only when a property-age band crosses a
cutoff. It does not replace the heat-loss equations, thermal-bridge factors, selected
constructions, room-temperature defaults or separate experimental reference method.

The age-band dropdown remains the normal input. `Year built` (`hl_build_year`) appears
only for automatic ventilation selection in:

- I: 1996-2002, which spans the pre-2000 cutoff;
- J: 2003-2006, because the source's categories overlap at 2006.

It is hidden for every other band and Unknown, and when an explicit ventilation
age category has already been selected. A retained hidden year cannot override the
selected band or an explicit category. No duplicate year/band entry is required.

## Source and boundary handling

Source: Worcester Bosch training presentation **WBTA-000061-001-042024d**, slide 48,
`Ventilation rates`. Its footnote labels the columns `pre-2000 (A)`, `2000-2006 (B)`
and `2006+ (C)`. These A/B/C labels are ventilation categories, not RdSAP property
age-band letters. The original source remains private, outside this repository.

- 1996-1999 in band I selects the pre-2000 category.
- 2000-2002 in band I selects the 2000-2006 category.
- 2003-2005 in band J selects the 2000-2006 category.
- 2006 in band J is not assigned silently to the newer category. The source labels
  overlap, so the existing band value is retained provisionally. The UI directs
  the surveyor to **Calculation assumptions and adjustments > Ventilation age
  category** to record an explicit confirmed selection.
- K-M retain their existing newer-category mapping. This feature does not make
  the legacy room table a current MCS infiltration method.

The room rates are not changed. A construction year is an age-based assumption,
not evidence of the dwelling's current airtightness or later ventilation changes.
Evidence-based manual category and room ACH overrides remain authoritative.

## Compatibility and invalid input

Blank, fractional, malformed and out-of-band years do not select a different rate.
The existing band calculation is retained and visibly marked provisional for review.
No midpoint year is invented. An imported older survey with no year clears a year
left over from the previously open survey and retains the legacy numerical result.

The optional field uses the existing generic save, reload and JSON import/export
path. Schema 4 and the existing boiler calculation version remain unchanged: the
new result requires an explicitly entered input or category; opening an old survey
alone must not change any numerical result. Printed assumptions record the valid
year and its category source, or the unresolved assumption.

The independent natural-ventilation comparison still gates on actual incomplete
rooms and its own supported inputs. A provisional legacy age assumption does not
turn complete rooms into missing reference inputs or change reference arithmetic.

## Verification

- `test/build-year-ventilation.test.js`: independent resolver boundaries, visibility
  decision, override priority, invalid input and legacy fallback.
- `test/browser/build-year-ventilation.spec.js`: actual UI visibility, independent
  ventilation-watt change, overrides, manual temperature retention, stale-year
  protection, reload/JSON import, original-survey restoration, reference isolation
  and a real Chromium-exported PDF with recorded year/category.
- Existing unit/syntax and full local browser suites remain required.
- The previous complete 126-case age-band numerical matrix is replayed in a new
  private evidence directory with the year blank, retaining its original evidence.
