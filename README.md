# DroidVault — Android App Hub (GitHub Pages Ready)

DroidVault is a 100% static-compatible Android APK showcase, release hub, and direct download portal. It requires **zero backend server**, deploys automatically to **GitHub Pages**, stores metadata & member download history in **Firebase Firestore**, and uses **GitHub Releases** (up to 2 GB per APK, free CDN) + **Cloudinary / Direct Cloud Links** for APK and media storage.

---

## Recommended Storage Architecture (ස්ටොරේජ් තෝරාගැනීම)

Because GitHub Pages hosts static files only (no Node.js server), DroidVault uses a purpose-built static storage stack:

| Asset Type | Recommended Storage | Free Limit | Why It Fits GitHub Pages |
| :--- | :--- | :--- | :--- |
| **Android APK files** | **GitHub Releases** | Up to **2 GB per file**, unlimited public bandwidth | Direct HTTPS download URLs, auto-synced inside Admin Studio via public GitHub API |
| **Icons, Screenshots & Promo Videos** | **Cloudinary (Unsigned Preset)** or **Direct HTTPS** | 25 free credits/month (images & video) | 100% browser-direct upload with zero backend server |
| **Catalog, Accounts & Download Counts** | **Firebase Firestore + Google Auth** | Generous Spark free tier | Real-time sync, hardened Security Rules, works natively from GitHub Pages |

---

## How to Publish on GitHub Pages (GitHub එකේ Publish කරන ආකාරය)

### 1. Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial DroidVault GitHub Pages release"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

### 2. Enable GitHub Pages (GitHub Actions)
1. Open your GitHub repository → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Wait ~1 minute for the **Deploy DroidVault to GitHub Pages** workflow to turn green.
4. Your site will be live at `https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/`.

### 3. Allow Google Sign-In on GitHub Pages (ඉතා වැදගත්!)
1. Open [Firebase Console](https://console.firebase.google.com/) → select your project (`gen-lang-client-0390672167`).
2. Go to **Authentication** → **Settings** → **Authorized domains**.
3. Click **Add domain** and add:
   ```
   <YOUR_USERNAME>.github.io
   ```
4. Save. Google Sign-In and Admin Studio will now work smoothly on your live GitHub Pages URL.

---

## Uploading APKs via GitHub Releases (APK Upload කරන ආකාරය)
1. In your GitHub repository, go to **Releases** → **Draft a new release**.
2. Create a tag (e.g. `v2.4.0`), attach your `.apk` file (up to 2 GB), and click **Publish release**.
3. Open **Admin Studio** inside DroidVault, enter your repo (`username/repo-name`), and click **Fetch Releases**.
4. Select your `.apk` asset — DroidVault automatically fills the download URL, filename, file size, version, and release notes.

---

## Local Development
```bash
npm install
npm run dev
```
