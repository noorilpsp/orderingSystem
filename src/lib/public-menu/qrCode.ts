export function qrServerImageUrl(data: string, size = 480): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    margin: "8",
    format: "png",
    data,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

export function qrDownloadFilename(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `qr-${slug || "menu"}.png`;
}

export async function downloadQrPng(menuUrl: string, filename: string): Promise<void> {
  const response = await fetch(qrServerImageUrl(menuUrl, 480));
  if (!response.ok) {
    throw new Error("Failed to generate QR code");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
