
/* src/components/BrandLogo.jsx */
import React from "react";
export default function BrandLogo({ brand, height = 28 }) {
  if (!brand?.logoUrl) return null;
  return (
    <img
      src={brand.logoUrl}
      alt={`${brand.name || "Brand"} logo`}
      height={height}
      style={{ height, objectFit: "contain" }}
    />
  );
}
