// Builds the Care N Safe chatbot (v4: quantity buttons + exact-amount UPI QR)
// and writes it as JSON for deploy.js. Products/prices: src/lib/carensafe/catalog.json
// Usage: node carensafe-flow.js <out.json> <orderTagId> <expertTagId> <upiTagId> <staticQrUrl> <payBaseUrl>
const fs = require("fs");
const { catalog, orderTotal } = require("./pricing");
const { qrPublicUrl } = require("./qr-paths");

const [, , OUT, TAG_ORDER, TAG_EXPERT, TAG_UPI, STATIC_QR, PAY_BASE] = process.argv;
if (!PAY_BASE) throw new Error("usage: <out> <tagOrder> <tagExpert> <tagUpi> <staticQrUrl> <payBaseUrl>");
const SUPABASE_URL = fs.readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();

const MIN = catalog.freeDeliveryMin;
const inr = (n) => `₹${n.toLocaleString("en-IN")}`;
const DELIVERY_TIME = "📦 Delivery: 🇮🇳 India *3–5 days* · 🌍 Outside India *10–14 days*";

const FEATURES = {
  pad:
    "✅ 100% Organic Cotton – chemical-free & safe\n" +
    "✅ 11-in-1 Protection\n" +
    "✅ 100% Rash-Free comfort\n" +
    "✅ Leak Lock Technology\n" +
    "✅ Ultra Soft top layer · Breathable material\n" +
    "✅ Dermatologically Tested",
  mega:
    "✅ 100% Uterus Protection · 10-in-1 Technology\n" +
    "✅ 9 Layer Protection · absorbs up to 250 ml\n" +
    "✅ Anti-Rash Formula · breathable hot-air cotton\n" +
    "✅ Individually wrapped pads",
  razor: "✅ German Technology\n✅ Safety first\n✅ Smoothness guaranteed\n✅ For under arms, bikini & legs",
};

const nk = (p) => p.key.replace("-", "_");

function deliveryText(p, qty) {
  const { subtotal, delivery } = orderTotal(p, qty);
  if (subtotal >= MIN) return "🚚 Delivery: *FREE*";
  if (delivery === null) return `🚚 Delivery charge: our team will confirm (FREE on ${inr(MIN)}+)`;
  return `🚚 Delivery charge: ${inr(delivery)} (FREE on ${inr(MIN)}+)`;
}

function qtyTitle(p, qty) {
  const { subtotal } = orderTotal(p, qty);
  return `${qty} pack${qty > 1 ? "s" : ""} – ${inr(subtotal)}`;
}

const DETAILS_FORM =
  "Name:\nPhone:\nAddress (with country if outside India):\nPincode:\n\n" +
  "📝 *Example:*\nName: Anjali\nPhone: 9876543210\nAddress: House 12, MG Road, Kochi\nPincode: 682001";

function productNodes(p) {
  const k = nk(p);
  const nodes = [
    {
      node_key: `${k}_info`,
      node_type: "send_buttons",
      config: {
        header_text: `${p.row} 💗`,
        text:
          `*${p.name}*\n📦 ${p.pack}\n\n${FEATURES[p.kind]}\n\n` +
          `💰 Price: *${inr(p.price)}*\n` +
          (p.price >= MIN ? "🚚 *FREE delivery*" : `🚚 FREE delivery on orders of ${inr(MIN)}+`) +
          `\n${DELIVERY_TIME}\n💳 Pay online via UPI`,
        buttons: [
          { reply_id: `cns_${k}_buy`, title: "🛒 Buy Now", next_node_key: `${k}_qty` },
          { reply_id: `cns_${k}_expert`, title: "🙋 Talk to Expert", next_node_key: "expert_msg" },
          { reply_id: `cns_${k}_menu`, title: "⬅️ Main Menu", next_node_key: "welcome" },
        ],
      },
    },
    {
      node_key: `${k}_qty`,
      node_type: "send_buttons",
      config: {
        header_text: "How many packs? 🛒",
        text:
          `*${p.name}* – ${inr(p.price)} per pack\n\n` +
          (p.price >= MIN ? "🚚 FREE delivery on every pack!" : `💡 Orders of ${inr(MIN)}+ get *FREE delivery!*`) +
          `\n\nNeed more than ${catalog.maxQty}? Tap one option and tell us the quantity in your details 🙏`,
        buttons: Array.from({ length: catalog.maxQty }, (_, i) => ({
          reply_id: `cns_${k}_q${i + 1}`,
          title: qtyTitle(p, i + 1),
          next_node_key: `${k}_q${i + 1}_form`,
        })),
      },
    },
  ];

  for (let qty = 1; qty <= catalog.maxQty; qty++) {
    const { subtotal, delivery, total } = orderTotal(p, qty);
    const amountLines =
      `🛍 *${p.name}* × ${qty}\n` +
      `💰 Price: ${inr(subtotal)}\n` +
      deliveryText(p, qty) +
      (total !== null ? `\n💳 *Total to pay: ${inr(total)}*` : `\n💳 *Pay: ${inr(subtotal)} + delivery charge*`);
    const q = `${k}_q${qty}`;
    nodes.push(
      {
        node_key: `${q}_form`,
        node_type: "collect_input",
        config: {
          prompt_text:
            `Great choice! 💗\n\n${amountLines}\n\n` +
            `To book your order, just *copy, fill & send* these details in *ONE message* 👇\n\n` +
            DETAILS_FORM,
          var_key: "details",
          validation: "any",
          next_node_key: `${q}_confirm`,
        },
      },
      {
        node_key: `${q}_confirm`,
        node_type: "send_message",
        config: {
          text:
            `✅ *Order Booked!* 🎉\n\n${amountLines}\n\n` +
            `📋 *Your details:*\n{{vars.details}}\n\n` +
            `👉 *Tap to pay:* ${PAY_BASE}/pay/${p.key}?qty=${qty}\n` +
            `or scan the QR code below${total !== null ? ` – the amount *${inr(total)}* is already filled in` : ""} 👇\n\n` +
            `After paying, please *send the payment screenshot here* 📸\n\n` +
            `${DELIVERY_TIME} after payment is confirmed\n\n` +
            `Thank you for choosing *Care N Safe* 🌸`,
          next_node_key: `${q}_qr`,
        },
      },
      {
        node_key: `${q}_qr`,
        node_type: "send_media",
        config: {
          media_type: "image",
          media_url: total !== null ? qrPublicUrl(SUPABASE_URL, p.key, qty) : STATIC_QR,
          caption:
            total !== null
              ? `Care N Safe – scan & pay ${inr(total)} 💗`
              : `Care N Safe – UPI QR 💗 Pay ${inr(subtotal)} + delivery charge`,
          next_node_key: "order_tag",
        },
      },
    );
  }
  return nodes;
}

const listSection = (prefix, next) => [
  {
    title: "Care N Safe products",
    rows: catalog.products.map((p) => ({
      reply_id: `cns_${prefix}_${nk(p)}`,
      title: p.row,
      description: p.desc,
      next_node_key: `${nk(p)}_${next}`,
    })),
  },
];

const nodes = [
  { node_key: "start", node_type: "start", config: { next_node_key: "welcome" } },
  {
    node_key: "welcome",
    node_type: "send_buttons",
    config: {
      header_text: "🌸 Welcome to Care N Safe 🌸",
      text:
        "Forget about period worries! 💗\n\n" +
        "*CareNSafe Premium Cotton Sanitary Pads*\n" +
        "✨ 100% Organic Cotton – chemical-free & safe\n" +
        "✨ 11-in-1 Protection · Leak Lock Technology\n" +
        "✨ 100% Rash-Free · Ultra Soft & Breathable\n" +
        "✨ Dermatologically Tested · Proudly Made in India 🇮🇳\n\n" +
        `🚚 *FREE delivery on orders above ${inr(MIN)}*\n` +
        `${DELIVERY_TIME}\n` +
        "💳 Easy & secure online payment (UPI)\n\n" +
        "👇 Tap below to order yours today!",
      footer_text: "Packs from ₹199 · Combos from ₹419",
      buttons: [
        { reply_id: "cns_order", title: "🛒 Order Now", next_node_key: "order_pick" },
        { reply_id: "cns_details", title: "📦 View Products", next_node_key: "details_pick" },
        { reply_id: "cns_expert", title: "🙋 Talk to Expert", next_node_key: "expert_msg" },
      ],
    },
  },
  {
    node_key: "details_pick",
    node_type: "send_list",
    config: {
      text: `Here is our full range 💗\n🚚 FREE delivery on orders above ${inr(MIN)}\n\nTap to see details 👇`,
      button_label: "View products",
      sections: listSection("info", "info"),
    },
  },
  {
    node_key: "order_pick",
    node_type: "send_list",
    config: {
      text: "Awesome! 🛒 Which product would you like to order?\n\n⭐ *Best value:* 40 Pads Mega Pack – ₹699 with FREE delivery",
      button_label: "Choose product",
      sections: listSection("order", "qty"),
    },
  },
  ...catalog.products.flatMap(productNodes),
  { node_key: "order_tag", node_type: "set_tag", config: { mode: "add", tag_id: TAG_ORDER, next_node_key: "upi_tag" } },
  { node_key: "upi_tag", node_type: "set_tag", config: { mode: "add", tag_id: TAG_UPI, next_node_key: "upi_handoff" } },
  { node_key: "upi_handoff", node_type: "handoff", config: { note: "UPI order – check the payment arrived in PhonePe, then dispatch" } },
  {
    node_key: "expert_msg",
    node_type: "send_message",
    config: {
      text: "🙏 Thank you! Our Care N Safe expert will reply to you here shortly.\n\nPlease type your question 👇",
      next_node_key: "expert_tag",
    },
  },
  { node_key: "expert_tag", node_type: "set_tag", config: { mode: "add", tag_id: TAG_EXPERT, next_node_key: "expert_handoff" } },
  { node_key: "expert_handoff", node_type: "handoff", config: { note: "Customer asked to talk to an expert" } },
].map((n, i) => ({ ...n, position_x: 0, position_y: i * 160 }));

const flows = [
  {
    name: "Care N Safe – Main menu",
    description: "Sends the welcome menu when a customer says hi / hello / menu.",
    trigger_type: "keyword",
    trigger_config: {
      keywords: ["hi", "hii", "hiii", "hi!", "hello", "hello!", "helo", "hai", "hey", "menu", "start", "order", "price", "details"],
      match_type: "exact",
      case_sensitive: false,
    },
  },
  {
    name: "Care N Safe – New customer welcome",
    description: "Sends the welcome menu on a customer's very first message (e.g. from a Facebook/Instagram ad).",
    trigger_type: "first_inbound_message",
    trigger_config: {},
  },
].map((f) => ({ ...f, entry_node_id: "start", nodes }));

fs.writeFileSync(OUT, JSON.stringify(flows, null, 2));
console.log(`wrote ${flows.length} flows x ${nodes.length} nodes`);
