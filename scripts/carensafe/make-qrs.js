// Generates one UPI QR (amount pre-filled) per product × quantity and uploads
// it to the public `flow-media` bucket at a fixed path, so the chatbot can
// send the exact-amount QR. Re-run after changing prices / delivery charge.
// Usage: node scripts/carensafe/make-qrs.js
const fs = require("fs");
const QRCode = require("qrcode");
const { catalog, orderTotal, upiLink } = require("./pricing");

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim();
const SUPABASE_URL = get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = get("SUPABASE_SERVICE_ROLE_KEY");

const { qrPath, qrPublicUrl } = require("./qr-paths");

async function main() {
  for (const p of catalog.products) {
    for (let qty = 1; qty <= catalog.maxQty; qty++) {
      if (orderTotal(p, qty).total === null) continue; // amount unknown → static QR is used
      const png = await QRCode.toBuffer(upiLink(p, qty), { type: "png", width: 640, margin: 3, errorCorrectionLevel: "M" });
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/flow-media/${qrPath(p.key, qty)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "image/png", "x-upsert": "true" },
        body: png,
      });
      if (!res.ok) throw new Error(`${p.key} x${qty}: ${res.status} ${await res.text()}`);
      console.log(`uploaded ${p.key} x${qty} → ₹${orderTotal(p, qty).total}`);
    }
  }
  console.log("example:", qrPublicUrl(SUPABASE_URL, "pack40", 1));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
