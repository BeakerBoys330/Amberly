# Put Amberly online (alpha)

You need three free accounts. Make them in this order: **GitHub** (stores the code),
**Supabase** (sharing and accounts), **Vercel** (hosts the app). The first time takes about
1 hour.

Amberly works without Supabase. If you skip section 2, the sharing and sign-in screens do
not show. All data stays on the device.

The live alpha is at https://amberly-coral.vercel.app. Vercel builds it from the `main`
branch on GitHub.

---

## 1. GitHub: upload the code (GitHub Desktop)

The repository is BeakerBoys330/Amberly. It already exists. If you repeat these steps, do
not create a second repository.

1. Open GitHub Desktop and sign in.
2. If the repository is in the list, select it. Go to step 5.
3. If the repository is not in the list, tap **File → Add local repository**. Choose
   `C:\Users\smith\Amberly`.
4. If GitHub Desktop says this folder is not a repository, tap **create a repository**.
   Set the name to `Amberly`. Leave all other settings as they are. Tap **Create
   repository**. Then tap **Publish repository** at the top. Keep **"Keep this code
   private"** selected. Tap **Publish**.
5. After each change, type a summary at the bottom left, for example `Amberly alpha`. Tap
   **Commit to main**. Then tap **Push origin**.

The file `.gitignore` keeps these items out of GitHub: `node_modules`, `dist`, the test
photos and `.env.local` (your keys). GitHub never gets them.

## 2. Supabase: accounts and sharing

1. Go to supabase.com. Tap **Start your project**. Sign in with GitHub.
2. Tap **New project**. Set the name to `amberly`. Make a strong database password and save
   it in a password manager. Set the region to **East US**. Wait about 2 minutes.
3. In the left menu, tap **SQL Editor**, then **New query**. Open `supabase/schema.sql` in
   this folder. Copy all of it and paste it into the query. Tap **Run**. You see
   "Success."
4. Go to **Authentication → Sign In / Providers → Email**. Make sure Email is on.
5. Go to **Authentication → Emails → Templates → "Magic Link"**. Replace the body with the
   contents of `supabase/email-code-template.html`:
   ```
   <h2>Your Amberly sign-in code</h2>
   <p>Enter this code in the app: <b>{{ .Token }}</b></p>
   <p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
   ```
   Do the same for the **"Confirm signup"** template. Save both templates. If you do not
   do this, Supabase sends a link and not a code. Then sign-in in the app does not work.
6. Supabase sends only a few emails each hour with its built-in email. This is enough for
   you, but it is not enough for 15 testers. Before you invite testers, go to
   **Authentication → Emails → SMTP Settings**. Set up a free sender, for example Resend
   (resend.com, 3,000 emails each month are free). Ask Claude to help you.
7. Go to **Project Settings → API Keys**. Copy the **Project URL**. Copy the
   **Publishable key** (it starts with `sb_publishable_`).
   **Never copy the "secret" key into the app or into GitHub.**
8. To test sharing on your PC, copy `.env.example` to `.env.local`. Paste the two values
   into it. Restart `npm run dev`.

**See what people shared:** In Supabase, go to **Table Editor → shared_items** for the
data. Go to **Storage → shared-photos** for the photos. The photos of each user are in a
folder with the user id as its name. **Authentication → Users** shows the email for each
id.

**Training data:** Use only the rows where `for_training` is **true**. Do not use rows that
are shared only with followers. The Terms make this promise.

**Reports:** When testers can follow each other, this is your job. Check **Table Editor →
reports** at least each day. The Terms promise a review in 24 hours. For each report, look
at the post (`item_id`) or the user (`reported_user_id`). Then do one of these actions:
delete the post, delete the user (**Authentication → Users → Delete**), or leave it. Then
set `status` to `resolved`. If a report is about selling, minors or threats, delete the
account.

## 3. Vercel: put it online

1. Go to vercel.com. Sign up with GitHub.
2. Tap **Add New → Project**. Select `Amberly`. Tap **Import**.
3. Open **Environment Variables**. Add both variables:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
4. Tap **Deploy**. You get a link, for example `amberly-xyz.vercel.app`.
5. In Supabase, go to **Authentication → URL Configuration**. Set **Site URL** to that
   link.

Each **Push origin** from GitHub Desktop updates the live app in about 1 minute. Testers
get the new version when they next open the app.

6. **Bot check on sign-in (before a wide launch):** The bot check stops bots. Without it,
   bots can use the sign-in form to send spam to email inboxes. The order of these three
   steps is important.
   - Go to dash.cloudflare.com (a free account is enough). Tap **Turnstile → Add
     widget**. Set the name to `Amberly`. Set the hostnames to your Vercel address (for
     example `amberly-coral.vercel.app`) and `localhost`. Set the widget mode to
     **Managed**. Tap **Create**.
   - Copy the **Site key**. In Vercel, go to Settings → Environment Variables. Add it as
     `VITE_TURNSTILE_SITE_KEY`. To test on your PC, also add it to `.env.local`. Then
     redeploy.
   - Wait until the new deploy is live. Then, in Supabase, go to **Authentication →
     Attack Protection**. Turn on **CAPTCHA protection**. Set the provider to
     **Turnstile**. Paste the **Secret key**. Tap Save. If you do this step first,
     sign-in breaks until the deploy is live.

## 4. Testers

- **iPhone:** Open the link in **Safari**. Tap Share, then **Add to Home Screen**. This is
  necessary. Safari erases the data of a website that is not opened for 7 days, unless the
  website is on the Home Screen.
- **Android:** Open the link in **Chrome**. Tap ⋮, then **Install app**.
- The app shows a "Keep Amberly on your Home Screen" card with these steps. Testers can
  follow the card.
- After the first open, Amberly works offline.

## 5. Before you invite testers

- [ ] Open the live link on your iPhone and on your Android device. Accept the agreement.
      Scan a real loupe photo. Share it. Check that it shows in Supabase.
- [ ] Tap **Stop sharing** and **Delete account**. Check that the data is gone in
      Supabase.
- [ ] Use a second account (a friend, or a second email) to test following: request,
      approve, see their grow in **Following**, react, block.
- [ ] Set up SMTP (step 2.6).
- [ ] Turn on the bot check (step 3.6). Then sign in with a new email and check that the
      code arrives and the sign-in succeeds.
- [ ] Choose the final web address first. The data on a device is tied to the address. If
      you change the address later, the testers start again with no data.
