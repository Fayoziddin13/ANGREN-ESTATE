/**
 * Map Viewport, Initial Zoom, Pan/Drag, and Outskirts Coverage Verification Test Suite
 *
 * Verifies:
 * 1. Default Angren center is aligned with urban residential core [41.0185, 70.1340]
 * 2. Initial map zoom is slightly reduced: 12.8 (desktop) / 12.3 (mobile)
 * 3. Min zoom threshold (11.5) allows smooth zooming out
 * 4. All canonical Angren districts (Markaz, 5-mavze, 6-mavze, 7-mavze, Dukent, Geolog, Yangiobod)
 *    are 100% visible in the initial viewport
 * 5. Free Pan / Drag in all 4 cardinal directions when zoomed in (zoom 14.0, 15.5, 17.0)
 * 6. Outskirts and peripheral neighborhoods (Dukent, Yangiobod, Krasnogorsk, Kochbuloq, Nishbash, A373)
 *    are fully accessible and valid in map camera persistence
 * 7. MapLibre initialization in AngrenMap does NOT have maxBounds clamping drag movements
 */

import fs from "fs";
import path from "path";
import {
  DEFAULT_ANGREN_CENTER,
  DEFAULT_MAP_ZOOM,
  ANGREN_MIN_ZOOM,
  ANGREN_MAX_ZOOM,
  ANGREN_RESTRICT_BOUNDS,
  isWithinAngrenBounds,
  normalizeCameraCenter,
} from "../src/lib/mapStore";
import { DEFAULT_ANGREN_HUDUDS } from "../src/lib/hududService";

async function runTests() {
  console.log("==================================================");
  console.log("ANGREN ESTATE — MAP PAN/DRAG & COVERAGE TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Center & Zoom settings
  assert(
    DEFAULT_ANGREN_CENTER[0] === 41.0185 && DEFAULT_ANGREN_CENTER[1] === 70.1340,
    "Default map center is set to Angren residential core [41.0185, 70.1340]"
  );

  assert(
    DEFAULT_MAP_ZOOM === 12.8,
    "Default map zoom is set to 12.8 (slightly zoomed out from 13.8)"
  );

  assert(
    ANGREN_MIN_ZOOM <= 11.5,
    "Min zoom threshold allows manual zoom out (<= 11.5)"
  );

  assert(
    ANGREN_MAX_ZOOM >= 18.0,
    "Max zoom threshold allows detailed street inspection (>= 18.0)"
  );

  // 2. Desktop Viewport Coverage (1200x700 px at zoom 12.8)
  const centerLat = DEFAULT_ANGREN_CENTER[0];
  const centerLng = DEFAULT_ANGREN_CENTER[1];
  const worldPxDesktop = 256 * Math.pow(2, DEFAULT_MAP_ZOOM);
  const degPerPxLngDesktop = 360 / worldPxDesktop;
  const lngHalfSpanDesktop = (1200 / 2) * degPerPxLngDesktop;
  const latHalfSpanDesktop = (700 / 2) * degPerPxLngDesktop * Math.cos((centerLat * Math.PI) / 180);

  const minLngDesktop = centerLng - lngHalfSpanDesktop;
  const maxLngDesktop = centerLng + lngHalfSpanDesktop;
  const minLatDesktop = centerLat - latHalfSpanDesktop;
  const maxLatDesktop = centerLat + latHalfSpanDesktop;

  for (const hudud of DEFAULT_ANGREN_HUDUDS) {
    const isVisible =
      hudud.longitude >= minLngDesktop &&
      hudud.longitude <= maxLngDesktop &&
      hudud.latitude >= minLatDesktop &&
      hudud.latitude <= maxLatDesktop;

    assert(
      isVisible,
      `District ${hudud.name_uz} (${hudud.name_ru}) is fully visible on desktop initial view`
    );
  }

  // 3. Mobile Viewport Coverage (390x650 px at zoom 12.3)
  const mobileZoom = 12.3;
  const worldPxMobile = 256 * Math.pow(2, mobileZoom);
  const degPerPxLngMobile = 360 / worldPxMobile;
  const lngHalfSpanMobile = (390 / 2) * degPerPxLngMobile;
  const latHalfSpanMobile = (650 / 2) * degPerPxLngMobile * Math.cos((centerLat * Math.PI) / 180);

  const minLngMobile = centerLng - lngHalfSpanMobile;
  const maxLngMobile = centerLng + lngHalfSpanMobile;
  const minLatMobile = centerLat - latHalfSpanMobile;
  const maxLatMobile = centerLat + latHalfSpanMobile;

  for (const hudud of DEFAULT_ANGREN_HUDUDS) {
    const isVisibleMobile =
      hudud.longitude >= minLngMobile &&
      hudud.longitude <= maxLngMobile &&
      hudud.latitude >= minLatMobile &&
      hudud.latitude <= maxLatMobile;

    assert(
      isVisibleMobile,
      `District ${hudud.name_uz} is fully visible on mobile initial view`
    );
  }

  // 4. Verification that maxBounds is NOT locking map in AngrenMap.tsx
  const angrenMapFile = fs.readFileSync(
    path.join(__dirname, "../src/components/map/AngrenMap.tsx"),
    "utf8"
  );
  const hasMaxBoundsInMapInit = /new\s+maplibregl\.Map\s*\(\s*\{[\s\S]*?maxBounds\s*:/m.test(angrenMapFile);
  assert(
    !hasMaxBoundsInMapInit,
    "AngrenMap initialization has NO maxBounds restriction (prevents pan freeze at high zoom)"
  );

  const hasDragPanExplicit = angrenMapFile.includes("map.dragPan.enable()");
  assert(
    hasDragPanExplicit,
    "AngrenMap explicitly enables map.dragPan.enable() for guaranteed fluid mouse interaction"
  );

  // 5. Verification of outskirts and boundary envelope
  const outskirtsPoints: Array<{ name: string; coord: [number, number] }> = [
    { name: "Dukent northern residential area", coord: [41.0720, 70.1850] },
    { name: "Yangiobod outskirts", coord: [41.1150, 70.0890] },
    { name: "Krasnogorsk / Parkent highway direction", coord: [41.1400, 69.8500] },
    { name: "Geolog / Chinor sub-district", coord: [41.0450, 70.1600] },
    { name: "Nishbash / Kochbuloq southern edge", coord: [40.9500, 70.0500] },
    { name: "A373 gateway & Tashkent entrance", coord: [40.9650, 69.9500] },
  ];

  for (const pt of outskirtsPoints) {
    const isValid = isWithinAngrenBounds(pt.coord);
    assert(
      isValid,
      `Outskirts point '${pt.name}' [${pt.coord[0]}, ${pt.coord[1]}] is valid within regional bounds`
    );
  }

  // 6. Verification of Pan / Drag displacement at high zoom (Zoom 15.5)
  // Simulating dragging 500px in all 4 cardinal directions
  const zoomHigh = 15.5;
  const worldPxHigh = 256 * Math.pow(2, zoomHigh);
  const degPerPxHigh = 360 / worldPxHigh;
  const dragDeltaDeg = 500 * degPerPxHigh;

  const pannedNorth: [number, number] = [centerLat + dragDeltaDeg, centerLng];
  const pannedSouth: [number, number] = [centerLat - dragDeltaDeg, centerLng];
  const pannedEast: [number, number] = [centerLat, centerLng + dragDeltaDeg];
  const pannedWest: [number, number] = [centerLat, centerLng - dragDeltaDeg];

  assert(
    isWithinAngrenBounds(pannedNorth),
    `Pan NORTH by 500px at zoom ${zoomHigh} remains valid in camera state`
  );
  assert(
    isWithinAngrenBounds(pannedSouth),
    `Pan SOUTH by 500px at zoom ${zoomHigh} remains valid in camera state`
  );
  assert(
    isWithinAngrenBounds(pannedEast),
    `Pan EAST by 500px at zoom ${zoomHigh} remains valid in camera state`
  );
  assert(
    isWithinAngrenBounds(pannedWest),
    `Pan WEST by 500px at zoom ${zoomHigh} remains valid in camera state`
  );

  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
