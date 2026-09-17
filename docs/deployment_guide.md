# Complete Deployment Guide: PRAKASHAN AI
### "Drying solutions for global agriculture"

This guide covers step-by-step deployment options for **Prakashan AI**:
1. **Instant Web Dashboard Deployment** (Free 1-click cloud hosting: Netlify, Vercel, GitHub Pages)
2. **Cloud API & AI Backend Deployment** (Render, Railway, Fly.io)
3. **On-Farm 24/7 Edge Gateway** (Raspberry Pi / Local Mini PC via Serial)
4. **Android App APK Deployment** (Google Play / Direct APK Sideload)

---

## 🚀 Option 1: 30-Second Web Dashboard Deployment (Free)

The `dashboard/` folder contains pure static HTML5, CSS3, JavaScript, and PWA assets. It can be hosted anywhere for free.

### Method A: Drag & Drop on Netlify Drop (Fastest — 30 Seconds, No CLI required)
1. Go to **[https://app.netlify.com/drop](https://app.netlify.com/drop)** in your browser.
2. Sign in or continue as guest.
3. Drag and drop the `dashboard` folder directly onto the browser window:
   `C:\Users\ASUS\.gemini\antigravity\scratch\prakshan_ai\dashboard`
4. Netlify will instantly provide a live HTTPS URL (e.g., `https://prakashan-ai.netlify.app`).

---

### Method B: Deploy via Vercel CLI (1 Minute)
1. Open PowerShell / Terminal in the `dashboard` folder:
   ```bash
   cd C:\Users\ASUS\.gemini\antigravity\scratch\prakshan_ai\dashboard
   ```
2. Run the Vercel deployment command:
   ```bash
   npx vercel --prod
   ```
3. Follow the 2-step prompt (accept defaults).
4. Vercel will build and output your global live URL (e.g., `https://prakashan-ai.vercel.app`).

---

### Method C: Deploy via GitHub Pages
1. Initialize Git in the project and push to GitHub:
   ```bash
   cd C:\Users\ASUS\.gemini\antigravity\scratch\prakshan_ai
   git init
   git add .
   git commit -m "Deploy Prakashan AI"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/prakashan-ai.git
   git push -u origin main
   ```
2. On GitHub, go to your repository **Settings > Pages**.
3. Under **Branch**, select `main` and set the folder to `/dashboard` (or `/root`), then click **Save**.
4. Your site will be live at `https://YOUR_USERNAME.github.io/prakashan-ai/dashboard/`.

---

## ☁ Option 2: Cloud Telemetry & AI Server Deployment (Render / Railway)

If you want the Python AI inference engine (`python/server.py`) running 24/7 in the cloud:

### Deploy to Render.com (Free Tier)
1. Go to **[https://render.com](https://render.com)** and create a new **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Environment**: `Python 3`
   - **Root Directory**: `python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
4. Click **Create Web Service**.
5. Render assigns a live API & dashboard endpoint (e.g. `https://prakashan-ai.onrender.com`).

---

## 🍓 Option 3: On-Farm 24/7 Edge Gateway (Raspberry Pi / Local Mini PC)

For offline field operation without continuous internet access:

1. **Hardware Setup**:
   - Connect Arduino Uno to Raspberry Pi via USB cable.
2. **Install & Run**:
   ```bash
   cd /home/pi/prakshan_ai/python
   pip3 install -r requirements.txt
   python3 server.py
   ```
3. **Configure Systemd Auto-Start on Boot**:
   Create `/etc/systemd/system/prakashan-ai.service`:
   ```ini
   [Unit]
   Description=Prakashan AI Solar Seed Dryer Gateway
   After=network.target

   [Service]
   User=pi
   WorkingDirectory=/home/pi/prakshan_ai/python
   ExecStart=/usr/bin/python3 server.py
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start the service:
   ```bash
   sudo systemctl enable prakashan-ai
   sudo systemctl start prakashan-ai
   ```
4. Farmers and operators on the same local Wi-Fi / hotspot can view the live dashboard by navigating to `http://raspberrypi.local:8080`.

---

## 📱 Option 4: Deploying as an Android APK

Once the dashboard is hosted (e.g., on Vercel or Netlify):
1. Go to **[https://www.pwabuilder.com](https://www.pwabuilder.com)**.
2. Enter your live URL (e.g., `https://prakashan-ai.vercel.app`).
3. Click **"Package for Android"** > **Download APK**.
4. Distribute the `.apk` file to farmers and agricultural technicians for instant installation on Android phones and tablets!
