/**
 * Whether the bottom-right editing controls (the Flat toggle, the phone's arc menu) belong on
 * screen. While a camera is chosen the bottom row holds that camera's render controls, and on a
 * phone it runs under those corners: "Render" could not be tapped (QA 2026-11-05 #1). A camera
 * view is for taking the picture, so the editing corners step aside until it is left.
 */
export function showsEditingCorners({ panorama, cameraStation }: { panorama: boolean; cameraStation: number | null }): boolean {
  return !panorama && cameraStation == null
}
