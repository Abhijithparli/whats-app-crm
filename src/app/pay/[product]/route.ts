/**
 * Public UPI payment page for Care N Safe chatbot orders.
 *
 * WhatsApp does not make `upi://` links tappable, so the chatbot sends
 * an https link to this page instead (`/pay/<product>?qty=<n>`). The page
 * opens the customer's UPI app (PhonePe / GPay / Paytm) through a
 * `upi://pay` intent with the order total pre-filled, and shows the QR as
 * a fallback for desktop / iOS users.
 *
 * Products and prices live in src/lib/carensafe/catalog.json, shared with
 * the chatbot scripts in scripts/carensafe/.
 *
 * Not behind auth: `/pay` is not in the middleware's protectedPaths.
 */
import type { NextRequest } from 'next/server'
import catalog from '@/lib/carensafe/catalog.json'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const QR_OWNER = '0d75ca85-b303-48e3-b78c-e4b7adc11351'
const STATIC_QR_URL = `${SUPABASE_URL}/storage/v1/object/public/flow-media/${QR_OWNER}/carensafe-upi-qr.jpg`

type Product = (typeof catalog.products)[number]

// Mirrors orderTotal() in scripts/carensafe/pricing.js — keep them in sync.
function orderTotal(product: Product, qty: number) {
  const subtotal = product.price * qty
  const free = subtotal >= catalog.freeDeliveryMin
  const delivery: number | null = free ? 0 : catalog.deliveryCharge
  return { subtotal, delivery, total: delivery === null ? null : subtotal + delivery }
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export async function GET(req: NextRequest, ctx: RouteContext<'/pay/[product]'>) {
  const { product: key } = await ctx.params
  const product = catalog.products.find((p) => p.key === key)
  if (!product) {
    return new Response('Product not found', { status: 404 })
  }

  const rawQty = Number.parseInt(req.nextUrl.searchParams.get('qty') ?? '1', 10)
  const qty = Number.isFinite(rawQty) && rawQty >= 1 && rawQty <= 50 ? rawQty : 1
  const { subtotal, delivery, total } = orderTotal(product, qty)

  const params = new URLSearchParams({
    pa: catalog.upiId,
    pn: catalog.payeeName,
    cu: 'INR',
    tn: `Care N Safe – ${product.name} x${qty}`,
  })
  if (total !== null) params.set('am', total.toFixed(2))
  // Some UPI apps don't decode %40 in the payee address, so keep '@' literal.
  const upiLink = `upi://pay?${params.toString().replace(/\+/g, '%20').replace('%40', '@')}`

  const qrUrl =
    total !== null && qty <= catalog.maxQty
      ? `${SUPABASE_URL}/storage/v1/object/public/flow-media/${QR_OWNER}/upi-qr/${product.key}-x${qty}.png`
      : STATIC_QR_URL

  const deliveryLine =
    delivery === 0
      ? 'Delivery: FREE'
      : delivery === null
        ? `Delivery charge: our team will confirm (FREE on ${inr(catalog.freeDeliveryMin)}+)`
        : `Delivery: ${inr(delivery)}`
  const totalLine = total !== null ? `Total: ${inr(total)}` : `Total: ${inr(subtotal)} + delivery`

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
  .line{color:#475569;font-size:14px;margin:2px 0}
  .total{font-size:26px;font-weight:800;margin:10px 0 18px;color:#1e1b4b}
  .pay{display:block;background:#db2777;color:#fff;text-decoration:none;font-weight:700;font-size:18px;padding:16px;border-radius:14px;box-shadow:0 6px 16px rgba(219,39,119,.35)}
  .note{font-size:13px;color:#64748b;margin:14px 0}
  img{width:100%;max-width:280px;border-radius:12px;margin-top:8px;background:#fff}
  .upi{font-family:monospace;background:#fff;padding:6px 10px;border-radius:8px;display:inline-block}
</style>
</head>
<body>
<main>
  <h1>🌸 Care N Safe</h1>
  <p class="product">${escapeHtml(product.name)} × ${qty}</p>
  <p class="line">${escapeHtml(`${inr(product.price)} × ${qty} = ${inr(subtotal)}`)}</p>
  <p class="line">${escapeHtml(deliveryLine)}</p>
  <p class="total">${escapeHtml(totalLine)}</p>
  <a class="pay" href="${escapeHtml(upiLink)}">Pay with PhonePe / GPay / Paytm</a>
  <p class="note">After paying, send the payment screenshot on WhatsApp 📸</p>
  <p class="note">Button not working? Scan this QR or pay to <span class="upi">${escapeHtml(catalog.upiId)}</span></p>
  <img src="${escapeHtml(qrUrl)}" alt="Care N Safe UPI QR code">
</main>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
