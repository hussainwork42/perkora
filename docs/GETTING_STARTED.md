# Getting started: from the zip to a working Perkora

This guide is for running Perkora yourself without being a developer. **If your computer cannot install Node.js, skip straight to Stage 2:** it runs entirely in the browser. There are three stages:

1. **Run it on your own computer** to try it (about 20 minutes).
2. **Put it online** so phones and real cafés can use it (about 30 minutes).
3. **Sign up a café** and print its QR code.

You need two free things for all of this:

- **Node.js 22**, from [nodejs.org](https://nodejs.org) (choose the LTS installer).
- **A free PostgreSQL database** from [Neon](https://neon.com). No credit card is needed, and the free plan does not expire.

> The app already comes built inside the zip (`dist/` and `public/assets/`), so you do **not** need to run `npm install`.

---

## Stage 1: run it on your computer

### 1. Create the database

1. Sign up at [neon.com](https://neon.com) and create a project. Choose a European region (for example Frankfurt), which is closest to Cyprus.
2. On the project dashboard, click **Connect** and copy the connection string. Use the **direct** connection, not the "pooled" one. It looks like:
   `postgresql://neondb_owner:abc123@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require`

### 2. Configure Perkora

1. Unzip `perkora.zip` somewhere easy, for example `Documents\perkora`.
2. In that folder, copy `.env.example` and rename the copy to `.env`.
3. Open `.env` in Notepad (or TextEdit) and change these lines:

```
DATABASE_URL=postgresql://...the string you copied from Neon...
APP_SECRET=type-any-long-random-text-of-at-least-32-characters
DEMO_PASSWORD=choose-a-password-for-the-demo-accounts
```

### 3. Create the tables, the demo café and your admin account

Open a terminal in the `perkora` folder. On Windows, right-click the folder and choose **Open in Terminal**. On a Mac, open Terminal and type `cd ` followed by the folder path.

Run these one at a time:

```
node dist/cli.cjs migrate
node dist/cli.cjs seed
node dist/cli.cjs create-admin --email you@example.com --name "Your Name"
```

The last command prints a **temporary password once**. Save it, then change it after signing in (Account → Password).

### 4. Start it

```
node dist/server.cjs
```

Open **http://localhost:3000** in your browser. Keep the terminal open; closing it stops the app.

**What to try:**

- Sign in with the demo shortcuts on the sign-in page: Owner, Staff or Customer. They use your `DEMO_PASSWORD`.
- Follow [DEMO_GUIDE.md](DEMO_GUIDE.md) for the full 15-step walkthrough.
- Sign in with your admin email to see the platform admin (`/admin`).

### Testing with your phone on the same Wi-Fi (optional)

QR codes contain the app's address. `localhost` only works on the computer itself, so to scan codes with your phone:

1. Find your computer's local IP address. On Windows, run `ipconfig` and look for "IPv4 Address", for example `192.168.1.20`. On a Mac, look in System Settings → Wi-Fi → Details.
2. In `.env`, set `APP_URL=http://192.168.1.20:3000`, using your own address.
3. Restart the server: press Ctrl+C, then run `node dist/server.cjs` again. If Windows asks whether Node.js may use the network, allow it on **private** networks.
4. On your phone, open `http://192.168.1.20:3000`, or scan a café QR code.

Phones only allow camera scanning inside a website on secure `https://` addresses. On this local `http://` setup, staff should **type the 8-character member code** instead of scanning. Scanning in the terminal needs the online version from Stage 2.

---

## Stage 2: put it online with Render (no installation, works from any computer)

You can do this stage without Stage 1. Everything happens in the browser, so it works on an old computer that cannot install Node.js.

1. **GitHub.** Create a free account at github.com. Click **+ → New repository**, name it `perkora`, choose **Private**, and click **Create repository**. Leave it empty.
2. **Upload the code.** Either:
   - connect GitHub to Claude (Claude settings → Connectors) and ask Claude to push the code to your `perkora` repository; or
   - upload the files yourself with **Add file → Upload files**. Upload at most 100 files at a time, and never upload a `.env` file.
3. **Render.**
   1. Sign up at render.com with your GitHub account.
   2. Choose **New → Blueprint** and select `perkora`. Render reads `render.yaml` and sets up the app and a database in Frankfurt.
   3. It asks for two values: **ADMIN_EMAIL** (your email) and **ADMIN_PASSWORD** (12 or more characters). These are your platform-admin login.
   4. Click **Apply**.
4. After about 5 minutes you get an address like `https://perkora-xxxx.onrender.com`. Open it on your laptop or phone.

On first start, the app sets everything up itself: tables, plans, your admin account and the demo café. Sign in with the demo buttons on the sign-in page, or with your admin email to reach `/admin`.

**Free-plan limits:**

- The free web app **sleeps after 15 minutes without visitors** and takes about a minute to wake up.
- Render's free database **expires 30 days after it is created**, with a 14-day grace period before deletion.

That is fine for testing and demos. Before real cafés rely on it, move to a paid always-on plan and a permanent database. You switch database by changing `DATABASE_URL` in Render's Environment settings, for example to a free Neon database, which does not expire.

If you add your own domain later (for example `perkora.app`), set `APP_URL=https://perkora.app` in Render's Environment settings.

**Check camera scanning.** On your phone, sign in as demo staff, open the **Counter terminal** and tap **Scan customer QR**. This is the first time camera scanning can be tried on a real device, so test it before promising it to a café.

---

## Stage 3: activate a real café

### The café owner signs up

1. Send everyone the same link: `your-address/start`. Café owners choose **Set up my café**; customers choose **Find a café**. (`/get-started` goes straight to café sign-up.)
2. The owner creates their account.
3. They complete the five setup steps:
   - **café details:** name, city, currency (EUR or TRY), colours;
   - **loyalty programme:** stamps and/or points;
   - **first reward;**
   - **look and QR code:** layout, photo banner, stamp design, welcome message;
   - **review**, then **Activate loyalty programme**.
4. The café is now live, with a 30-day free trial on Premium recorded on its subscription.

### The QR codes ("barcodes")

Perkora creates every code itself; you never need a separate QR generator.

| Code | What it does | Where to find it |
|---|---|---|
| **Café join code** | Customers scan it with their phone camera to join that café's loyalty card | Dashboard → **Download QR code** (or Café Settings → QR code), then **Print poster**. Also shown at the end of setup. |
| **Customer's member code** | Identifies the customer at the counter. It changes every 5 minutes and contains no personal data | Customer's phone → their card → **Show at the counter**. The 8-character code underneath can be typed instead of scanned |

Staff scan the member code in the **Counter terminal** with **Scan customer QR**, or type the 8-character code, then add stamps or points or redeem a reward.

The codes contain the app's address, so print posters **after** the app is online at its final address. If the address changes later (for example when you add your own domain), print them again.

### Staff accounts

The owner goes to Dashboard → **Team** → **Create invitation link** and sends the link to the staff member, for example by WhatsApp. The staff member opens it, creates an account, and lands on the counter terminal. The owner chooses what each staff member is allowed to do.

### Billing

Perkora does not take card payments yet. When a café wants a paid plan:

1. The owner requests the plan on their **Subscription** page.
2. You collect the payment yourself, for example by bank transfer.
3. In **Admin → Cafés**, use **Activate** and **Mark paid**.

The 30-day trial end date is recorded, but nothing locks a café automatically when it passes. Follow up from the admin list.

### Before real cafés use it

Read [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). In short:

- Have the privacy policy and terms reviewed, and add your real company details.
- Consider setting `DEMO_MODE=false` on the live site, so the demo café and its shortcuts are hidden. You can keep a separate demo copy for sales.
- Use an always-on hosting plan.
