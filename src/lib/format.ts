import type { Product } from "@/lib/types";

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function productDisplayName(product?: Product | null) {
  if (!product) return "-";
  const productName = titleCase(product.name);
  const brand = product.brands?.name?.trim();
  const brandName = brand && brand.toUpperCase() !== "NOBRAND" ? ` - ${brand.toUpperCase()}` : "";
  return `${productName}${brandName}`;
}
