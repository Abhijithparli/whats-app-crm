// Builds the Care N Safe chatbot (v3: full product range, UPI payment link + QR)
// and writes it as JSON for deploy.js.
// Usage: node carensafe-flow.js <out.json> <orderTagId> <expertTagId> <upiTagId> <qrImageUrl> <payBaseUrl>
const fs = require("fs");

const [, , OUT, TAG_ORDER, TAG_EXPERT, TAG_UPI, QR_URL, PAY_BASE] = process.argv;
if (!PAY_BASE) throw new Error("usage: <out> <tagOrder> <tagExpert> <tagUpi> <qrUrl> <payBaseUrl>");

const FREE_DELIVERY_MIN = 399;
const DELIVERY_TIME = "📦 Delivery: 🇮🇳 India *3–5 days* · 🌍 Outside India *10–14 days*";
const PAD_FEATURES =
  "✅ 100% Organic Cotton – chemical-free & safe\n" +
  "✅ 11-in-1 Protection\n" +
  "✅ 100% Rash-Free comfort\n" +
  "✅ Leak Lock Technology\n" +
  "✅ Ultra Soft top layer · Breathable material\n" +
  "✅ Dermatologically Tested";

// key must match src/app/pay/[product]/route.ts
const PRODUCTS = [
  { key: "l", name: "CareNSafe Premium Cotton L Pads", row: "L Pads 280mm – ₹199", desc: "10 pads · Normal flow", price: 199, pack: "10 pads · Size L · 280 mm", features: PAD_FEATURES },
  { key: "xl", name: "CareNSafe Premium Cotton XL Pads", row: "XL Pads 320mm – ₹220", desc: "10 pads · Medium–heavy flow", price: 220, pack: "10 pads · Size XL · 320 mm", features: PAD_FEATURES },
  { key: "xxl", name: "CareNSafe Premium Cotton XXL Pads", row: "XXL Pads 350mm – ₹230", desc: "10 pads · Heavy flow & night", price: 230, pack: "10 pads · Size XXL · 350 mm", features: PAD_FEATURES },
  { key: "combo-normal", name: "CareNSafe Combo Pack (Normal Flow)", row: "Combo Normal – ₹419", desc: "20 pads · L + XL · FREE delivery", price: 419, pack: "20 pads · Sizes L / XL", features: PAD_FEATURES },
  { key: "combo-heavy", name: "CareNSafe Combo Pack (Heavy Flow)", row: "Combo Heavy – ₹450", desc: "20 pads · XL + XXL · FREE delivery", price: 450, pack: "20 pads · Sizes XL / XXL", features: PAD_FEATURES },
  {
    key: "pack40", name: "CareNSafe 40 Pads Mega Pack", row: "40 Pads Mega – ₹699", desc: "Full cycle pack · Best value · FREE delivery", price: 699,
    pack: "40 pads · 🤍 L 280 mm ×20 · 🌹 XL 320 mm ×10 · 💙 XXL 350 mm ×10",
    features:
      "✅ 100% Uterus Protection · 10-in-1 Technology\n" +
      "✅ 9 Layer Protection · absorbs up to 250 ml\n" +
      "✅ Anti-Rash Formula · breathable hot-air cotton\n" +
      "✅ Individually wrapped pads",
  },
  {
    key: "razor", name: "CareNSafe Premium Razor", row: "Razor (2 pcs) – ₹100", desc: "German technology", price: 100, pack: "2 razors",
    features: "✅ German Technology\n✅ Safety first\n✅ Smoothness guaranteed\n✅ For under arms, bikini & legs",
  },
];

const free = (p) => p.price >= FREE_DELIVERY_MIN;
const deliveryLine = (p) =>
  free(p)
    ? "🚚 *FREE delivery*"
    : `🚚 Delivery charge applies below ₹${FREE_DELIVERY_MIN}\n💡 Order ₹${FREE_DELIVERY_MIN}+ (e.g. 2 packs) & get *FREE delivery!*`;

const DETAILS_FORM =
  "Name:\nPhone:\nAddress (with country if outside India):\nPincode:\nQuantity:\n\n" +
  "📝 *Example:*\n" +
  "Name: Anjali\nPhone: 9876543210\nAddress: House 12, MG Road, Kochi\nPincode: 682001\nQuantity: 1";

function productNodes(p) {
  const k = p.key.replace("-", "_");
  return [
    {
      node_key: `${k}_info`,
      node_type: "send_buttons",
      config: {
        header_text: `${p.row.replace(/ – /, " – ")} 💗`.slice(0, 60),
        text:
          `*${p.name}*\n📦 ${p.pack}\n\n${p.features}\n\n` +
          `💰 Price: *₹${p.price}*\n${deliveryLine(p)}\n${DELIVERY_TIME}\n💳 Pay online via UPI`,
        buttons: [
          { reply_id: `cns_${k}_buy`, title: "🛒 Buy Now", next_node_key: `${k}_form` },
          { reply_id: `cns_${k}_expert`, title: "🙋 Talk to Expert", next_node_key: "expert_msg" },
          { reply_id: `cns_${k}_menu`, title: "⬅️ Main Menu", next_node_key: "welcome" },
        ],
      },
    },
    {
      node_key: `${k}_form`,
      node_type: "collect_input",
      config: {
        prompt_text:
          `Great choice! 💗 *${p.name}* – *₹${p.price}*\n\n` +
          `To book your order, just *copy, fill & send* these details in *ONE message* 👇\n\n` +
          DETAILS_FORM,
        var_key: "details",
        validation: "any",
        next_node_key: `${k}_confirm`,
      },
    },
    {
      node_key: `${k}_confirm`,
      node_type: "send_message",
      config: {
        text:
          `✅ *Order Booked!* 🎉\n\n` +
          `🛍 *${p.name}* – ₹${p.price} per pack\n\n` +
          `📋 *Your details:*\n{{vars.details}}\n\n` +
          `💳 *Pay now (UPI):* ₹${p.price} × quantity` +
          (free(p) ? "" : " + delivery charge (FREE on ₹399+)") +
          `\n👉 *Tap to pay:* ${PAY_BASE}/pay/${p.key}\nor scan the QR code below 👇\n\n` +
          `After paying, please *send the payment screenshot here* 📸\n\n` +
          `${DELIVERY_TIME} after payment is confirmed\n\n` +
          `Thank you for choosing *Care N Safe* 🌸`,
        next_node_key: `${k}_qr`,
      },
    },
    {
      node_key: `${k}_qr`,
      node_type: "send_media",
      config: {
        media_type: "image",
        media_url: QR_URL,
        caption: `Care N Safe – UPI QR 💗 Pay ₹${p.price} × quantity`,
        next_node_key: "order_tag",
      },
    },
  ];
}

const listSection = (prefix, next) => [
  {
    title: "Care N Safe products",
    rows: PRODUCTS.map((p) => ({
      reply_id: `cns_${prefix}_${p.key.replace("-", "_")}`,
      title: p.row,
      description: p.desc,
      next_node_key: `${p.key.replace("-", "_")}_${next}`,
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
        `🚚 *FREE delivery on orders above ₹${FREE_DELIVERY_MIN}*\n` +
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
      text: `Here is our full range 💗\n🚚 FREE delivery on orders above ₹${FREE_DELIVERY_MIN}\n\nTap to see details 👇`,
      button_label: "View products",
      sections: listSection("info", "info"),
    },
  },
  {
    node_key: "order_pick",
    node_type: "send_list",
    config: {
      text: `Awesome! 🛒 Which product would you like to order?\n\n⭐ *Best value:* 40 Pads Mega Pack – ₹699 with FREE delivery`,
      button_label: "Choose product",
      sections: listSection("order", "form"),
    },
  },
  ...PRODUCTS.flatMap(productNodes),
  { node_key: "order_tag", node_type: "set_tag", config: { mode: "add", tag_id: TAG_ORDER, next_node_key: "upi_tag" } },
  { node_key: "upi_tag", node_type: "set_tag", config: { mode: "add", tag_id: TAG_UPI, next_node_key: "upi_handoff" } },
  { node_key: "upi_handoff", node_type: "handoff", config: { note: "UPI order – check payment screenshot (add delivery charge if below ₹399), then dispatch" } },
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
