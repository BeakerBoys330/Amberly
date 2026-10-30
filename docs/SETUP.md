# Putting Amberly online (alpha)

Three free accounts, in this order: **GitHub** (stores the code) → **Supabase** (sharing
and accounts) → **Vercel** (hosts the app). About an hour the first time.

Amberly works without Supabase: if you skip part 2, sharing and sign-in simply don't
appear and everything stays on the phone.

---

## 1. GitHub: upload the code (GitHub Desktop)

1. Open GitHub Desktop and sign in.
2. **File → Add local repository** → choose `C:\Users\smith\Amberly`.
   It will say this isn't a repository yet; click **create a repository** there.
   Name: `amberly`. Leave everything else as is → **Create repository**.
3. Bottom-left: type a summary such as `Amberly alpha` → **Commit to main**.
4. Top: **Publish repository**. Keep **"Keep this code private"** checked → **Publish**.

From now on: after any change, write a summary → **Commit to main** → **Push origin**.

`.gitignore` already keeps out `node_modules`, `dist`, the test photos, and `.env.local`
(your keys), so none of those get uploaded.

## 2. Supabase: accounts and sharing

1. Go to supabase.com → **Start your project** → sign in with GitHub.
2. **New project**: name `amberly`, make up a strong database password (save it in a
   password manager), region **East US**. Wait about 2 minutes.
3. Left menu **SQL Editor** → **New query** → open `supabase/schema.sql` from this
   folder, copy all of it, paste, **Run**. You should see "Success."
4. **Authentication → Sign In / Providers → Email**: make sure Email is on.
5. **Authentication → Emails → Templates → "Magic Link"**: replace the body with the
   contents of `supabase/email-code-template.html`:
   ```
   <h2>Your Amberly sign-in code</h2>
   <p>Enter this code in the app: <b>{{ .Token }}</b></p>
   <p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
   ```
   Do the same for the **"Confirm signup"** template. Save both. (Without this, Supabase
   emails a link instead of a code and sign-in in the app won't work.)
6. **Email sending limit:** Supabase's built-in email only sends a few emails per
   hour, which is fine for you but not for 15 testers. Before inviting testers, set up
   **Authentication → Emails → SMTP Settings** with a free sender such as Resend
   (resend.com, 3,000 emails/month free). Ask Claude to walk you through it.
7. **Project Settings → API Keys**: copy the **Project URL** and the
   **Publishable key** (starts with `sb_publishable_`).
   **Never copy the "secret" key into the app or GitHub.**
8. To test sharing on your PC: copy `.env.example` to `.env.local` and paste the two
   values in. Restart `npm run dev`.

**Seeing what people shared:** Supabase → **Table Editor → shared_items** (the data)
and **Storage → shared-photos** (the photos). Each user's photos are in a folder named
with their user id; **Authentication → Users** shows which email that is.

**Training data:** only rows where `for_training` is **true**. Rows shared only with
followers must not be used for training — that's the promise in the Terms.

**Reports (your job once testers can follow each other):** check **Table Editor →
reports** at least daily; the Terms promise review within 24 hours. For each one, look
at the post (`item_id`) or user (`reported_user_id`), then either delete the post, delete
the user (**Authentication → Users → Delete**), or leave it. Set `status` to `resolved`.
Selling, anything involving minors, or threats → delete the account.

## 3. Vercel: put it online

1. Go to vercel.com → sign up with GitHub.
2. **Add New → Project** → pick `amberly` → **Import**.
3. Open **Environment Variables** and add both:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
4. **Deploy**. You get a link like `amberly-xyz.vercel.app`.
5. Back in Supabase → **Authentication → URL Configuration** → set **Site URL** to that
   link.

Every **Push origin** from GitHub Desktop now updates the live app within about a
minute. Testers get the new version the next time they open it.

## 4. Testers

- **iPhone:** open the link in **Safari** → Share → **Add to Home Screen**. (Required:
  Safari erases data for websites not opened in 7 days unless they're on the Home
  Screen.)
- **Android:** open in **Chrome** → ⋮ → **Install app**.
- After the first open, Amberly works offline.

## 5. Before inviting testers

- [ ] Open the live link on your iPhone and Android, accept the agreement, scan a real
      loupe photo, share it, then check it appears in Supabase.
- [ ] Try **Stop sharing** and **Delete account** and check the data disappears in
      Supabase.
- [ ] With a second account (a friend, or a second email), test following: request →
      approve → see their grow in **Following** → react → block.
- [ ] Set up SMTP (step 2.6).
- [ ] Pick the final web address first: data saved on phones is tied to the address,
      so changing it later starts testers over.
