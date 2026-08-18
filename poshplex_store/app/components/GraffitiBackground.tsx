"use client";

import React, { useMemo } from "react";
import { Permanent_Marker, Rock_Salt, Sedgwick_Ave_Display, Caveat } from "next/font/google";

const permanentMarker = Permanent_Marker({ weight: "400", subsets: ["latin"], preload: false });
const rockSalt = Rock_Salt({ weight: "400", subsets: ["latin"], preload: false });
const sedgwick = Sedgwick_Ave_Display({ weight: "400", subsets: ["latin"], preload: false });
const caveat = Caveat({ weight: ["700"], subsets: ["latin"], preload: false });

const fonts = [permanentMarker.className, rockSalt.className, sedgwick.className, caveat.className];
const words = ["STYLE", "LEGEND", "STREET", "POSHPLEX", "URBAN", "DESIGN", "SKETCH", "GRAFFITI", "ORIGINAL", "ART", "HEAVYWEIGHT", "BOXY", "DHAKA", "CULTURE", "CREATIVE"];

export default function GraffitiBackground() {
  // Use a deterministic pseudo-random generator so it matches server-side rendering
  // and doesn't cause hydration errors.
  const tags = useMemo(() => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const items = [];
    for (let i = 0; i < 150; i++) {
      items.push({
        word: words[Math.floor(random() * words.length)],
        font: fonts[Math.floor(random() * fonts.length)],
        top: `${random() * 120 - 10}%`,
        left: `${random() * 120 - 10}%`,
        rotate: `${random() * 60 - 30}deg`,
        fontSize: `${random() * 4 + 2}rem`,
        opacity: random() * 0.5 + 0.5,
        isOutline: random() > 0.7,
      });
    }
    return items;
  }, []);

  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "#111", // Dark background like the reference image
      overflow: "hidden",
      zIndex: 0,
      pointerEvents: "none"
    }}>
      {tags.map((tag, i) => (
        <span key={i} className={tag.font} style={{
          position: "absolute",
          top: tag.top,
          left: tag.left,
          transform: `translate(-50%, -50%) rotate(${tag.rotate})`,
          fontSize: tag.fontSize,
          color: tag.isOutline ? "transparent" : "rgba(255, 255, 255, 0.15)",
          WebkitTextStroke: tag.isOutline ? "2px rgba(255, 255, 255, 0.15)" : "none",
          whiteSpace: "nowrap",
          opacity: tag.opacity,
          lineHeight: 1
        }}>
          {tag.word}
        </span>
      ))}
    </div>
  );
}
