Aurora's direction is right: one play-button language, sort controls wherever a song list appears, and less surface inconsistency. But the current checked-out code does not yet contain the shared `AuroraPlayButton.tsx` or `useSongSort.ts` described in the prompt, and `PlaylistDetail.tsx` still has its own inline row play treatment with no sort dropdown. So this is not ready for a visual-restraint approval pass yet. The implementation still expresses the exact inconsistency called out in `new2.md`: All Songs, playlist rows, and PlayerBar are speaking related but different dialects.

The strongest restraint principle here is hierarchy. The PlayerBar play button may earn a small premium bloom because it is the main transport control and lives in the atmospheric chrome. Row hover buttons should not compete with it. They should feel immediate, quiet, and native to the table, with only enough affordance to say "click here." If a single variant API exists, it must enforce that hierarchy rather than simply offering three decorative presets.

The current PlayerBar button is close in intention but too self-contained around a fixed teal-ish star bloom. That risks fighting the per-song atmosphere principle from `PRODUCT.md`, especially because `new2.md` already calls out mismatched glow and bleed around the global player. The button should feel like a polished lens catching the current song's light, not a permanent cyan control floating above every song. The row buttons should inherit shape and icon grammar, but not the bloom.

The sort idea is good, but it needs to disappear into the list chrome. A compact dropdown plus clickable headers can feel native if it is visually subordinate to search and table headers. It becomes clutter if it sits as a separate pill competing with the playlist hero. Sort belongs directly above or inside the table header zone, not in the playlist identity area.

1. Fold: Land the shared play button only if the variants preserve hierarchy: `glass-bloom` for PlayerBar, `row-hover` as nearly invisible until hover, `inline` as a plain quiet table/action affordance. Do not let all variants share the same glow intensity.

2. Fold: Keep one component if the API is semantic and narrow: `variant="player" | "row" | "inline"`, `state="playing" | "paused" | "buffering"`, `disabled`, and `aria-label`. If variants start needing separate layout props, split into three components over a shared internal base.

3. Fold: Make PlayerBar's premium feel come from containment, material, and song-derived light. Reduce the free bleed around the control and avoid fixed cyan bloom as the default. The user note about using a blurred/zoomed album image as a controlled light source is worth a later prototype, but not inside this consolidation pass.

4. Fold: Add sort to `PlaylistDetail` in the song-list toolbar/header area, not the hero. The dropdown should be text-small, border-quiet, and aligned with the table's existing header rhythm.

5. Fold: Use clickable column headers everywhere a real table is shown. The dropdown is for explicit control; the headers are for power-user speed. Both should read as utility, not feature marketing.

6. Fold: Add fast press feedback to all play buttons. The app feels sluggish per `new2.md`; a 75-150ms `active:scale-[0.96-0.98]` and immediate icon state change matter more than another glow layer.

7. Skip: Do not make row-hover play buttons circular glass objects. That makes every table row feel like a mini PlayerBar and turns density into decoration.

8. Skip: Do not use gradient text or accent-heavy active states in playlist rows. The current playlist current-song title uses gradient text, which reads demo-y and violates the restraint critique.

9. Skip: Do not put sort controls in filtered result views unless the result ordering is clearly owned by that view. The prompt says sort everywhere, but Query Builder intentionally hides sort today; reintroduce it only if the filter result mental model supports local sorting.

10. Skip: Do not solve the PlayerBar bleed problem during the play-button extraction. It is real, but it is a separate visual-system audit involving album art, halo containment, waveform performance, and audio responsiveness.

Bottom line: unify the button language, but keep the PlayerBar as the only premium expression. Everything else should become quieter, faster, and more predictable. The current code still needs the actual shared component and playlist sort implementation before a final design-restraint review can judge whether the new API is too clever or appropriately contained.
