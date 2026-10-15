// Storage locations of the generated per-amount UPI QR images.
const OWNER = "0d75ca85-b303-48e3-b78c-e4b7adc11351";

const qrPath = (key, qty) => `${OWNER}/upi-qr/${key}-x${qty}.png`;
const qrPublicUrl = (supabaseUrl, key, qty) =>
  `${supabaseUrl}/storage/v1/object/public/flow-media/${qrPath(key, qty)}`;

module.exports = { qrPath, qrPublicUrl };
