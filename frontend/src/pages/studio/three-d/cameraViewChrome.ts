/**
 * Whether the bottom-right editing controls (the Flat toggle, the phone's arc menu) belong on
 * screen. While a camera is chosen the bottom row holds that camera's render controls, and on a
 * phone it runs under those corners: "Render" could not be tapped (QA 2026-11-05 #1). A camera
 * view is for taking the picture, so the editing corners step aside until it is left.
 */
export function showsEditingCorners({ panorama, cameraStation }: { panorama: boolean; cameraStation: number | null }): boolean {
  return !panorama && cameraStation == null
}

/**
 * How far from the right edge the bottom-left camera row has to stop, as a Tailwind class.
 *
 * The row used to run to `right-4` always, so with the corner buttons on screen its later
 * items wrapped in UNDER them: "My renders" sat beneath Flat (QA 2026-11-05 re-check R3).
 * It now ends short of whatever stands in that corner, and anything that does not fit wraps
 * upward instead (see CameraBar):
 *  - Flat stands at `right-20` and is up to ~125 px wide ("Квартира"), so 13.5rem clears it;
 *  - the arc alone is a 52 px button at `right-4`, and only on a phone (`lg:hidden`);
 *  - with a camera chosen both have stepped aside (`showsEditingCorners`).
 * Written out in full so Tailwind finds the classes in this file.
 */
export function cameraRowRightInset({ cornersShown, flatShown }: { cornersShown: boolean; flatShown: boolean }): string {
  if (!cornersShown) return 'right-4'
  return flatShown ? 'right-[13.5rem]' : 'right-20 lg:right-4'
}
