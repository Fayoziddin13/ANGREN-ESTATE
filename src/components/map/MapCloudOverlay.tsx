"use client";

import React, { forwardRef } from "react";

interface MapCloudOverlayProps {
  initialOpacity?: number;
}

export const MapCloudOverlay = forwardRef<HTMLDivElement, MapCloudOverlayProps>(
  ({ initialOpacity = 0.28 }, ref) => {
    return (
      <div
        ref={ref}
        id="map-cloud-overlay"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden select-none transition-opacity duration-300 ease-out z-[1]"
        style={{ opacity: initialOpacity }}
      >
        {/* ========================================================================= */}
        {/* LAYER 1: Distant High-Altitude Cirrus & Vapor Streamers (Slowest: 115s)   */}
        {/* ========================================================================= */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
          <div className="flex w-[200%] h-full animate-map-cloud-drift-high pointer-events-none">
            {/* Panel 1A */}
            <div className="w-1/2 h-full shrink-0">
              <svg
                className="w-full h-full"
                viewBox="0 0 2000 900"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="cloud-feather-high" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="40" />
                  </filter>
                </defs>
                <g filter="url(#cloud-feather-high)" fill="#FFFFFF">
                  <ellipse cx="380" cy="160" rx="350" ry="40" opacity="0.55" />
                  <ellipse cx="680" cy="140" rx="280" ry="34" opacity="0.45" />
                  <ellipse cx="1200" cy="380" rx="420" ry="46" opacity="0.52" />
                  <ellipse cx="1560" cy="350" rx="320" ry="38" opacity="0.48" />
                  <ellipse cx="460" cy="740" rx="380" ry="44" opacity="0.48" />
                  <ellipse cx="1080" cy="700" rx="360" ry="42" opacity="0.50" />
                  <ellipse cx="0" cy="280" rx="280" ry="36" opacity="0.50" />
                  <ellipse cx="2000" cy="280" rx="280" ry="36" opacity="0.50" />
                </g>
              </svg>
            </div>

            {/* Panel 1B: Exact Duplicate for Seamless Infinite Translation */}
            <div className="w-1/2 h-full shrink-0">
              <svg
                className="w-full h-full"
                viewBox="0 0 2000 900"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g filter="url(#cloud-feather-high)" fill="#FFFFFF">
                  <ellipse cx="380" cy="160" rx="350" ry="40" opacity="0.55" />
                  <ellipse cx="680" cy="140" rx="280" ry="34" opacity="0.45" />
                  <ellipse cx="1200" cy="380" rx="420" ry="46" opacity="0.52" />
                  <ellipse cx="1560" cy="350" rx="320" ry="38" opacity="0.48" />
                  <ellipse cx="460" cy="740" rx="380" ry="44" opacity="0.48" />
                  <ellipse cx="1080" cy="700" rx="360" ry="42" opacity="0.50" />
                  <ellipse cx="0" cy="280" rx="280" ry="36" opacity="0.50" />
                  <ellipse cx="2000" cy="280" rx="280" ry="36" opacity="0.50" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LAYER 2: Middle-Altitude Cumulus Cloud Formations (Medium: 75s)           */}
        {/* ========================================================================= */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-65">
          <div className="flex w-[200%] h-full animate-map-cloud-drift-mid pointer-events-none">
            {/* Panel 2A */}
            <div className="w-1/2 h-full shrink-0">
              <svg
                className="w-full h-full"
                viewBox="0 0 2000 900"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="cloud-feather-mid" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="26" />
                    <feDropShadow dx="0" dy="12" stdDeviation="18" floodColor="#062418" floodOpacity="0.14" />
                  </filter>
                </defs>
                <g filter="url(#cloud-feather-mid)" fill="#FFFFFF">
                  <circle cx="340" cy="220" r="90" opacity="0.88" />
                  <circle cx="430" cy="180" r="115" opacity="0.94" />
                  <circle cx="540" cy="170" r="125" opacity="0.94" />
                  <circle cx="640" cy="200" r="100" opacity="0.90" />
                  <circle cx="710" cy="230" r="80" opacity="0.85" />
                  <ellipse cx="520" cy="245" rx="230" ry="70" opacity="0.92" />

                  <circle cx="1180" cy="380" r="85" opacity="0.86" />
                  <circle cx="1260" cy="350" r="105" opacity="0.92" />
                  <circle cx="1360" cy="360" r="100" opacity="0.90" />
                  <ellipse cx="1300" cy="410" rx="170" ry="60" opacity="0.90" />

                  <circle cx="780" cy="660" r="80" opacity="0.86" />
                  <circle cx="850" cy="630" r="100" opacity="0.90" />
                  <circle cx="940" cy="650" r="90" opacity="0.88" />
                  <ellipse cx="880" cy="685" rx="150" ry="55" opacity="0.88" />

                  <circle cx="0" cy="520" r="85" opacity="0.85" />
                  <circle cx="2000" cy="520" r="85" opacity="0.85" />
                  <ellipse cx="0" cy="550" rx="140" ry="50" opacity="0.88" />
                  <ellipse cx="2000" cy="550" rx="140" ry="50" opacity="0.88" />
                </g>
              </svg>
            </div>

            {/* Panel 2B: Exact Duplicate for Seamless Infinite Translation */}
            <div className="w-1/2 h-full shrink-0">
              <svg
                className="w-full h-full"
                viewBox="0 0 2000 900"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g filter="url(#cloud-feather-mid)" fill="#FFFFFF">
                  <circle cx="340" cy="220" r="90" opacity="0.88" />
                  <circle cx="430" cy="180" r="115" opacity="0.94" />
                  <circle cx="540" cy="170" r="125" opacity="0.94" />
                  <circle cx="640" cy="200" r="100" opacity="0.90" />
                  <circle cx="710" cy="230" r="80" opacity="0.85" />
                  <ellipse cx="520" cy="245" rx="230" ry="70" opacity="0.92" />

                  <circle cx="1180" cy="380" r="85" opacity="0.86" />
                  <circle cx="1260" cy="350" r="105" opacity="0.92" />
                  <circle cx="1360" cy="360" r="100" opacity="0.90" />
                  <ellipse cx="1300" cy="410" rx="170" ry="60" opacity="0.90" />

                  <circle cx="780" cy="660" r="80" opacity="0.86" />
                  <circle cx="850" cy="630" r="100" opacity="0.90" />
                  <circle cx="940" cy="650" r="90" opacity="0.88" />
                  <ellipse cx="880" cy="685" rx="150" ry="55" opacity="0.88" />

                  <circle cx="0" cy="520" r="85" opacity="0.85" />
                  <circle cx="2000" cy="520" r="85" opacity="0.85" />
                  <ellipse cx="0" cy="550" rx="140" ry="50" opacity="0.88" />
                  <ellipse cx="2000" cy="550" rx="140" ry="50" opacity="0.88" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LAYER 3: Soft Foreground Atmospheric Mist & Vapor (Swiftest: 48s)         */}
        {/* ========================================================================= */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="flex w-[200%] h-full animate-map-cloud-drift-low pointer-events-none">
            {/* Panel 3A */}
            <div className="w-1/2 h-full shrink-0">
              <svg
                className="w-full h-full"
                viewBox="0 0 2000 900"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="cloud-feather-low" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="48" />
                  </filter>
                </defs>
                <g filter="url(#cloud-feather-low)" fill="#FFFFFF">
                  <ellipse cx="320" cy="450" rx="340" ry="80" opacity="0.55" />
                  <ellipse cx="980" cy="260" rx="380" ry="90" opacity="0.60" />
                  <ellipse cx="1650" cy="600" rx="360" ry="85" opacity="0.55" />
                  <ellipse cx="0" cy="760" rx="280" ry="70" opacity="0.50" />
                  <ellipse cx="2000" cy="760" rx="280" ry="70" opacity="0.50" />
                </g>
              </svg>
            </div>

            {/* Panel 3B: Exact Duplicate for Seamless Infinite Translation */}
            <div className="w-1/2 h-full shrink-0">
              <svg
                className="w-full h-full"
                viewBox="0 0 2000 900"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g filter="url(#cloud-feather-low)" fill="#FFFFFF">
                  <ellipse cx="320" cy="450" rx="340" ry="80" opacity="0.55" />
                  <ellipse cx="980" cy="260" rx="380" ry="90" opacity="0.60" />
                  <ellipse cx="1650" cy="600" rx="360" ry="85" opacity="0.55" />
                  <ellipse cx="0" cy="760" rx="280" ry="70" opacity="0.50" />
                  <ellipse cx="2000" cy="760" rx="280" ry="70" opacity="0.50" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MapCloudOverlay.displayName = "MapCloudOverlay";
