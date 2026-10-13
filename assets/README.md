# Scanner regression fixtures

- `kyogre-3.jpg`: user-provided photo of Kyogre, Celebrations 003/025, including background and a protective sleeve. Approved by the user for committing to this repository.
- `app-result-incorrect.png`: user-provided screenshot showing the original erroneous Seer suggestion. Approved by the user for committing to this repository.
- `mega-charizard-x-ex-94.jpg`: user-provided reflective gold Mega Charizard X ex photo; the catalog printing is Phantasmal Flames 130/094. The sleeve/foil obscures the collector number, so the regression requires name-only candidates including 130, not automatic exact identification.
- `mega-charizard-x-ex-94-error-scan.png`: reported erroneous Hala suggestions for that photo.
- `gengar-57.jpg`: user-provided Gengar 057/198 photo with a pumpkin stamp. OCR reads Gengar but not the number reliably. The regression verifies that the original Chilling Reign catalog entry remains accessible beyond the first page, entering 057 narrows the candidates, and choosing the stamped-reprint option withholds the original printing's price and marketplace links.

The browser regression uploads the original JPEG, runs the real local OCR worker, and checks that the sole candidate is Kyogre `cel25-3`, then confirms Celebrations and 3/25 in the details. Its provider fixtures include a different Kyogre printing, Seer, and another Pokémon numbered 3. These source fixtures are not copied into the deployed app.

The failure came from OCR regions anchored to the photo edges instead of the card, combined with matching across concatenated OCR fragments. The scanner now reads the whole photo and an enlarged lower region. Matching preserves line/word boundaries, tolerates split names such as “Kyo gre,” and requires agreement between the name and any readable collector number. Additional real-photo fixtures are still needed to measure broad recognition accuracy.

Reflective photos also exercise confidence filtering and a separate red-channel threshold fallback. The fallback accepts only long names with at most one OCR edit and keeps X/Y distinctions. Its UI states that the card number was not verified, and requires the collector to choose a printing before any price appears. It does not authenticate cards or establish that a physical item has the catalog printing's value.
