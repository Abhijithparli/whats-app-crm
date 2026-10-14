#!/usr/bin/env bash
# Re-points Meta's webhook and the chatbot's "Tap to pay" links at a new
# public URL (e.g. after a cloudflared quick tunnel restarts).
# Usage: bash scripts/carensafe/relink.sh https://new-url.trycloudflare.com
set -euo pipefail
cd "$(dirname "$0")/../.."

URL="${1%/}"
[ -n "$URL" ] || { echo "usage: relink.sh <public-url>"; exit 1; }
APP_ID=1803476907354039
VERIFY_TOKEN=carensafehook2026
QR="https://ltewajvkdjrtmioeunfk.supabase.co/storage/v1/object/public/flow-media/0d75ca85-b303-48e3-b78c-e4b7adc11351/carensafe-upi-qr.jpg"
SECRET=$(grep -E '^META_APP_SECRET=' .env.local | cut -d= -f2- | tr -d '\r ')
TMP=$(mktemp -d)

echo "1/3 checking $URL ..."
curl -sf --max-time 60 "$URL/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=ok&hub.verify_token=$VERIFY_TOKEN" >/dev/null

echo "2/3 updating Meta webhook ..."
curl -s --max-time 60 -X POST "https://graph.facebook.com/v23.0/$APP_ID/subscriptions" \
  --data-urlencode "object=whatsapp_business_account" \
  --data-urlencode "callback_url=$URL/api/whatsapp/webhook" \
  --data-urlencode "verify_token=$VERIFY_TOKEN" \
  --data-urlencode "fields=messages" \
  --data-urlencode "access_token=$APP_ID|$SECRET"
echo

echo "3/3 redeploying chatbot with new pay links ..."
node scripts/carensafe/carensafe-flow.js "$TMP/cns.json" TAG_ORDER_PH TAG_EXPERT_PH TAG_UPI_PH "$QR" "$URL"
node scripts/carensafe/deploy.js "$TMP/cns.json" "$TMP/cns.sql"
npx supabase db query --linked --file "$TMP/cns.sql" < /dev/null >/dev/null
rm -rf "$TMP"
echo "done: $URL"
