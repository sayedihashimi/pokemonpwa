# Scanner regression fixtures

- `kyogre-3.jpg`: user-provided photo of Kyogre, Celebrations 003/025, including background and a protective sleeve. Approved by the user for committing to this repository.
- `app-result-incorrect.png`: user-provided screenshot showing the original erroneous Seer suggestion. Approved by the user for committing to this repository.

The browser regression uploads the original JPEG, runs the real local OCR worker, and checks that the sole candidate is Kyogre `cel25-3`, then confirms Celebrations and 3/25 in the details. Its provider fixtures include a different Kyogre printing, Seer, and another Pokémon numbered 3. These source fixtures are not copied into the deployed app.

The failure came from OCR regions anchored to the photo edges instead of the card, combined with matching across concatenated OCR fragments. The scanner now reads the whole photo and an enlarged lower region. Matching preserves line/word boundaries, tolerates split names such as “Kyo gre,” and requires agreement between the name and any readable collector number. Additional real-photo fixtures are still needed to measure broad recognition accuracy.
