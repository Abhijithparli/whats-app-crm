# WhatsApp CRM — Step-by-Step Setup Guide

This guide takes you from zero to a working CRM connected to your
business WhatsApp number, with automations running.

**Status of this folder (checked 2026-10-13):**

| Check | Result |
| --- | --- |
| Dependencies (`npm install`) | ✅ installed |
| Type check (`npm run typecheck`) | ✅ no errors |
| Tests (`npm test`) | ✅ 96 files / 1142 tests pass (after fixing a Windows path bug in `vitest.config.ts`) |
| Lint (`npm run lint`) | ✅ 0 errors (40 style warnings from the original project, harmless) |
| Production build (`npm run build`) | ✅ builds |
| `.env.local` | ⚠️ created — `ENCRYPTION_KEY` generated, **Supabase + Meta values still needed** |

---

## How it works (big picture)

```
Customer's WhatsApp ──► Meta WhatsApp Cloud API ──► webhook ──► your CRM (Next.js)
                                                                   │
                                                          Supabase (database + login)
Your CRM ──► Meta WhatsApp Cloud API ──► Customer's WhatsApp
```

You need 3 things:

1. **Supabase** — free database + user login.
2. **Meta (Facebook) Developer app** with the WhatsApp product — the
   official WhatsApp Business API.
3. **A public HTTPS URL** for the CRM so Meta can deliver incoming
   messages (a tunnel while testing, a real host in production).

> ⚠️ **Important about your phone number:** a number connected to the
> WhatsApp Cloud API **cannot be used in the normal WhatsApp / WhatsApp
> Business phone app at the same time.** Either use a new number, or
> delete the WhatsApp account from that number in the app first
> (WhatsApp Business app → Settings → Account → Delete account). You
> will then read and reply to customers from this CRM instead of the
> phone app. Test with Meta's free test number first to be safe.

---

## PART 1 — Supabase (database)

1. Go to <https://supabase.com> → **Sign up** → **New project**.
   - Name: `wacrm`, set a strong database password (save it!), pick
     the region closest to you (e.g. Mumbai for India).
2. Wait ~2 minutes for the project to be created.
3. Open **Project Settings → API** (also called *API Keys*) and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (secret!) → `SUPABASE_SERVICE_ROLE_KEY`
4. Paste them into `.env.local` in this folder (open it in Notepad / VS Code).
5. Also note your **project ref** — the `abcdxyz` part of
   `https://abcdxyz.supabase.co`.

### 1b. Create the database tables

Run these in a terminal inside this folder (`D:\whatsapp crm\wacrm`):

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

(it asks for the database password from step 1)

```bash
npx supabase db push
```

This applies all 46 files in `supabase/migrations/` in order.

*Alternative (no CLI):* Supabase dashboard → **SQL Editor** → paste and
run each file in `supabase/migrations/` one by one, in number order
(001 → 046).

### 1c. Login emails

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` (change to your real domain later)
- **Redirect URLs**: add `http://localhost:3000/**` (and later
  `https://your-domain.com/**`)

> Tip for testing: Authentication → Providers → Email → you can turn
> off **Confirm email** so sign-up works instantly without an email.

---

## PART 2 — Run the CRM on your computer

```bash
npm run dev
```

Open <http://localhost:3000> → **Sign up** → create your owner account.
You will land on the dashboard. The CRM works now — but WhatsApp is
not connected yet.

---

## PART 3 — Create the Meta WhatsApp app

1. Go to <https://business.facebook.com> and make sure you have a
   **Meta Business portfolio** (create one with your business name if not).
2. Go to <https://developers.facebook.com> → **My Apps → Create App**.
   - Use case: **Other** → type **Business** (or pick
     "Connect with customers through WhatsApp").
   - Connect it to your Business portfolio.
3. In the app dashboard, add the **WhatsApp** product → **Set up**.
4. **App Settings → Basic** → click *Show* on **App Secret** → copy it
   into `.env.local` as `META_APP_SECRET`.
   (Also copy **App ID** into `META_APP_ID` if you want image-header
   templates — remove the `#` in front of that line.)
5. **Restart** the dev server after editing `.env.local`
   (Ctrl + C, then `npm run dev`).

### 3b. Get the IDs

App dashboard → **WhatsApp → API Setup**. Copy:

- **Phone number ID** (a long number — *not* the phone number itself)
- **WhatsApp Business Account ID** (WABA ID)

At first Meta gives you a **free test number**. Add your personal
mobile under *"To"* as a recipient so you can test.

### 3c. Get a PERMANENT access token

The token on the API Setup page expires in 24 hours — don't use it
for real use.

1. <https://business.facebook.com> → **Settings (Business settings) →
   Users → System users → Add** → name `wacrm`, role **Admin**.
2. Select the system user → **Assign assets** → **Apps**: your app
   (Full control) and **WhatsApp accounts**: your WABA (Full control).
3. **Generate new token** → choose your app → expiration **Never** →
   tick permissions **`whatsapp_business_management`** and
   **`whatsapp_business_messaging`** → Generate → **copy and save it**.

---

## PART 4 — Give the CRM a public HTTPS URL

Meta can only send messages to a public `https://` address.

**For testing (free):** install cloudflared and run, in a second terminal:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

It prints a URL like `https://random-words.trycloudflare.com`.
(ngrok also works: `ngrok http 3000`.) This URL changes every restart —
fine for testing, use real hosting for production (Part 8).

Add that URL to Supabase → Authentication → URL Configuration →
Redirect URLs too, and open the CRM through it.

---

## PART 5 — Connect your phone number to the CRM

1. In the CRM: **Settings → WhatsApp connection**. Fill in:
   - **Phone Number ID** (from 3b)
   - **WhatsApp Business Account ID** (from 3b)
   - **Permanent Access Token** (from 3c)
   - **Verify Token** — make up any secret word, e.g. `mybiz-verify-2026`
   - **Two-step PIN** — only for a real number (see Part 6); leave
     empty for the Meta test number
2. Click **Save Configuration**. The CRM checks everything with Meta and
   subscribes your WABA to the app. If something is wrong it tells you
   exactly which field — see `docs/whatsapp-connection-troubleshooting.md`.
3. Now tell Meta where to send messages: Meta app dashboard →
   **WhatsApp → Configuration → Webhook → Edit**:
   - **Callback URL**: `https://YOUR-PUBLIC-URL/api/whatsapp/webhook`
   - **Verify token**: the same word you typed in step 1
   - Click **Verify and save** (the CRM must be running).
4. Under **Webhook fields**, click **Subscribe** on **`messages`**.
5. Back in the CRM, click **Test API Connection** → should be green.

### Test it

- From your personal WhatsApp, send "Hi" to the test number →
  it appears in the CRM **Inbox** within seconds.
- Reply from the Inbox → it arrives on your phone.

> WhatsApp rule: you can reply freely for **24 hours** after the
> customer's last message. Outside that window (and for the first
> message to a new customer) you must use an **approved template**
> (Settings / Broadcasts → Templates).

---

## PART 6 — Use your REAL business number

1. Meta app → **WhatsApp → API Setup → Add phone number**.
2. Enter business display name, category, the number → verify by
   SMS/voice code. (Number must not be active on WhatsApp — see the
   warning at the top.)
3. In **WhatsApp Manager → Phone numbers → your number → Two-step
   verification**, set a **6-digit PIN**.
4. In the CRM → Settings → WhatsApp connection → change **Phone Number
   ID** to the new number's ID, enter the **PIN** → Save. The CRM
   registers the number with the Cloud API.
5. Add a **payment method** in Meta Business Settings → WhatsApp
   accounts → Payment settings (needed to message customers beyond the
   free tier; service replies inside 24h are free).
6. Recommended: complete **Business verification** in Meta Business
   Settings → Security Centre to raise your messaging limits.

---

## PART 7 — Automate your business WhatsApp

Go to **Automations → New**. You can start from built-in templates:

| Template | What it does |
| --- | --- |
| **Welcome message** | Auto-greets every new customer |
| **Out of office** | Replies when you are closed |
| **Lead qualifier** | Asks questions and tags the lead |
| **Follow-up reminder** | Follows up if the customer goes quiet |

**Triggers available:** new message received, first message from a new
customer, keyword match (e.g. "price", "menu", "order"), new contact
created, conversation assigned, tag added, time-based (schedule),
button/list reply.

**Actions:** send message / template / buttons, add or remove tags,
assign to a team member, create a deal in the pipeline, update a contact field, close the conversation, wait (minutes,
hours, days, or until the customer replies), if/else conditions, call
a webhook.

### Example setups

1. **Instant welcome + menu**
   Trigger *First inbound message* → Send buttons:
   "1. Price list  2. Place order  3. Talk to staff".
2. **Keyword replies**
   Trigger *Keyword match* `price` → Send your price list (text or PDF).
   Trigger *Keyword match* `location` → Send address + Google Maps link.
3. **Lead → sales pipeline**
   Trigger *Button reply = Place order* → Add tag `hot-lead` → Create
   deal in pipeline → Assign to sales staff.
4. **Follow-up**
   After quote sent → *Wait for reply 1 day* → if no reply → send
   follow-up template.
5. **AI auto-reply (24×7)**
   Settings → **AI Assistant** → paste your OpenAI/Anthropic key → add
   your FAQs, prices and policies to the **Knowledge base** → enable
   auto-reply. It answers customers from your own content and hands
   over to a human when needed.
6. **Broadcast offers**
   Contacts → import CSV → tag them → Broadcasts → New → choose an
   approved template → send to the tag.

> **Wait steps** need a scheduler: set `AUTOMATION_CRON_SECRET` in
> `.env.local` and have a cron service (e.g. cron-job.org) call
> `https://YOUR-URL/api/automations/cron` every minute with that
> secret in an `x-cron-secret` request header.

---

## PART 8 — Go live (production)

1. Put this code on GitHub (your own fork / private repo).
2. Deploy to a Node.js host — Hostinger (Node.js web app), Vercel,
   Railway, or a VPS with `npm run build && npm start`
   (Docker: `docs/docker.md`).
3. Set the same environment variables from `.env.local` on the host,
   but **change**:
   - `NEXT_PUBLIC_SITE_URL=https://your-domain.com`
   - remove `WHATSAPP_TEMPLATES_DRY_RUN` (or set `false`) so templates
     are really submitted to Meta.
4. Supabase → Authentication → URL Configuration → set Site URL to your
   domain.
5. Meta → WhatsApp → Configuration → change the webhook Callback URL to
   `https://your-domain.com/api/whatsapp/webhook`.

---

## Quick troubleshooting

| Problem | Fix |
| --- | --- |
| App won't start / "Invalid Supabase URL" | Fill all REQUIRED values in `.env.local`, restart `npm run dev` |
| Sign-up email link goes to wrong page | Supabase → URL Configuration (Part 1c) |
| "Access token has expired" | Use the System User permanent token (3c) |
| Webhook "Verify and save" fails | CRM must be running + reachable at the public URL; verify token must match exactly |
| Connected but no messages in Inbox | Subscribe the `messages` webhook field; `META_APP_SECRET` must be this app's secret; click **Verify with Meta** in Settings |
| Can't message a customer | Outside 24h window → use an approved template |

More detail: `docs/whatsapp-connection-troubleshooting.md`.
