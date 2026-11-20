import { lazy } from "react";

/** The Leaflet maps, loaded on first use so Leaflet stays out of the pages' main bundles. */
export const LazyShopsMap = lazy(() => import("./leafletMaps").then((m) => ({ default: m.ShopsMap })));
export const LazyPointPicker = lazy(() => import("./leafletMaps").then((m) => ({ default: m.PointPicker })));
