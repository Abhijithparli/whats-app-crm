/**
 * Public UPI payment page for Care N Safe chatbot orders.
 *
 * WhatsApp does not make `upi://` links tappable, so the chatbot sends
 * an https link to this page instead. The page opens the customer's UPI
 * app (PhonePe / GPay / Paytm) through a `upi://pay` intent, with the
 * QR image as a fallback for desktop / iOS users.
 *
 * Not behind auth: `/pay` is not in the middleware's protectedPaths.
 */
import type { NextRequest } from 'next/server'

const UPI_ID = '7356451527@ybl'
const PAYEE_NAME = 'Care N Safe'
const QR_IMAGE_URL =
  'https://ltewajvkdjrtmioeunfk.supabase.co/storage/v1/object/public/flow-media/0d75ca85-b303-48e3-b78c-e4b7adc11351/carensafe-upi-qr.jpg'
const FREE_DELIVERY_MIN = 399

const PRODUCTS: Record<string, { name: string; price: number }> = {
  l: { name: 'CareNSafe Premium Cotton L Pads (10)', price: 199 },
  xl: { name: 'CareNSafe Premium Cotton XL Pads (10)', price: 220 },
  xxl: { name: 'CareNSafe Premium Cotton XXL Pads (10)', price: 230 },
  'combo-normal': { name: 'CareNSafe Combo Pack – Normal Flow (20)', price: 419 },
  'combo-heavy': { name: 'CareNSafe Combo Pack – Heavy Flow (20)', price: 450 },
  pack40: { name: 'CareNSafe 40 Pads Mega Pack', price: 699 },
  razor: { name: 'CareNSafe Premium Razor (2 pcs)', price: 100 },
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/pay/[product]'>) {
  const { product: key } = await ctx.params
  const product = PRODUCTS[key]
  if (!product) {
    return new Response('Product not found', { status: 404 })
  }

  // Only pre-fill the amount when one pack already qualifies for free
  // delivery; below the threshold the total depends on quantity and the
  // delivery charge, so the customer enters it.
  const prefill = product.price >= FREE_DELIVERY_MIN
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: PAYEE_NAME,
    cu: 'INR',
    tn: `Care N Safe – ${product.name}`,
  })
  if (prefill) params.set('am', product.price.toFixed(2))
  // Some UPI apps don't decode %40 in the payee address, so keep '@' literal.
  const upiLink = `upi://pay?${params.toString().replace(/\+/g, '%20').replace('%40', '@')}`

  const amountLine = prefill
    ? `₹${product.price} per pack · FREE delivery`
    : `₹${product.price} per pack + delivery charge (FREE delivery on orders of ₹${FREE_DELIVERY_MIN}+)`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pay – Care N Safe</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf2f8;color:#1e1b4b}
  main{max-width:420px;margin:0 auto;padding:24px 16px;text-align:center}
  h1{font-size:22px;margin:8px 0 4px;color:#be185d}
  .product{font-weight:600;margin:12px 0 4px}
  .amount{color:#475569;font-size:14px;margin:0 0 20px}
  .pay{display:block;background:#db2777;color:#fff;text-decoration:none;font-weight:700;font-size:18px;padding:16px;border-radius:14px;box-shadow:0 6px 16px rgba(219,39,119,.35)}
  .note{font-size:13px;color:#64748b;margin:14px 0}
  img{width:100%;max-width:280px;border-radius:12px;margin-top:8px}
  .upi{font-family:monospace;background:#fff;padding:6px 10px;border-radius:8px;display:inline-block}
</style>
</head>
<body>
<main>
  <h1>🌸 Care N Safe</h1>
  <p class="product">${escapeHtml(product.name)}</p>
  <p class="amount">${escapeHtml(amountLine)}</p>
  <a class="pay" href="${escapeHtml(upiLink)}">Pay with PhonePe / GPay / Paytm</a>
  <p class="note">If you ordered more than 1 pack, enter the total amount in your UPI app.<br>After paying, send the payment screenshot on WhatsApp 📸</p>
  <p class="note">Button not working? Scan this QR or pay to <span class="upi">${UPI_ID}</span></p>
  <img src="${QR_IMAGE_URL}" alt="Care N Safe UPI QR code">
</main>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
