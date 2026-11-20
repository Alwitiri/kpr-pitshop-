import type { MetadataRoute } from "next";

/** Lets phones put Spoaxio Software on the home screen with its own icon (Chrome / Safari "Add to Home screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spoaxio Software",
    short_name: "Spoaxio",
    description: "Billing, stock, customers and WhatsApp for the shop – works on the shop Wi-Fi without internet",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0f19",
    theme_color: "#0b0f19",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
