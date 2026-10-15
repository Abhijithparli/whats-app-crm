// Shared order-total logic for the Care N Safe chatbot scripts.
// Mirrors orderTotal() in src/app/pay/[product]/route.ts — keep them in sync.
const catalog = require("../../src/lib/carensafe/catalog.json");

/**
 * Total for `qty` packs of `product`, including delivery.
 * Returns { subtotal, delivery, total } where `total` is null when a
 * delivery charge applies but catalog.deliveryCharge is not configured
 * (the amount then can't be pre-filled in the QR / payment link).
 */
function orderTotal(product, qty) {
  const subtotal = product.price * qty;
  const free = subtotal >= catalog.freeDeliveryMin;
  const delivery = free ? 0 : catalog.deliveryCharge;
  return { subtotal, delivery, total: delivery === null ? null : subtotal + delivery };
}

function upiLink(product, qty) {
  const { total } = orderTotal(product, qty);
  const params = new URLSearchParams({
    pa: catalog.upiId,
    pn: catalog.payeeName,
    cu: "INR",
    tn: `Care N Safe – ${product.name} x${qty}`,
  });
  if (total !== null) params.set("am", total.toFixed(2));
  return `upi://pay?${params.toString().replace(/\+/g, "%20").replace("%40", "@")}`;
}

module.exports = { catalog, orderTotal, upiLink };
