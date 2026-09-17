# Android APK Build Guide: PRAKASHAN AI
### How to Convert & Package the Dashboard into an Android APK App

This guide outlines **4 practical methods** to convert the **Prakashan AI** web dashboard into an installable Android `.apk` app for smartphones and tablets.

---

## 🌟 Method Comparison Matrix

| Method | Time Needed | Prerequisites | Offline Support | USB/Bluetooth Serial | Difficulty |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Method 1: Instant PWA Install** | **10 seconds** | Android Chrome / Edge | ✅ Yes | ✅ Web Serial (USB) | ⭐ Easiest (No build tools) |
| **Method 2: PWABuilder (Online APK)** | **2 minutes** | Web hosting (Free) | ✅ Yes | ✅ Web Serial | ⭐ Easy (1-Click APK Download) |
| **Method 3: Capacitor / Android Studio** | **5 minutes** | Node.js + Android Studio | ✅ Yes | ✅ USB OTG & BLE | ⭐⭐ Recommended for Custom Build |
| **Method 4: Native Kotlin WebView** | **10 minutes** | Android Studio | ✅ Yes | ✅ Native Hardware Drivers | ⭐⭐⭐ Advanced |

---

## Method 1: Instant Installation on Android (Direct PWA)
*No compilation or APK file download needed!*

The dashboard already includes [`manifest.json`](file:///c:/Users/Gupteswar%20Mohanty/.gemini/antigravity/scratch/prakshan_ai/dashboard/manifest.json) and [`sw.js`](file:///c:/Users/Gupteswar%20Mohanty/.gemini/antigravity/scratch/prakshan_ai/dashboard/sw.js) (Service Worker).

1. Transfer or host the `dashboard/` folder on a local network or free web host (e.g. GitHub Pages / Vercel).
2. Open the URL in **Google Chrome** on your Android phone.
3. Tap the **3 vertical dots (⋮)** in the top-right corner of Chrome.
4. Select **"Install app"** or **"Add to Home screen"**.
5. The **Prakashan AI** icon with our logo will appear on your phone's home screen, launching full-screen without browser address bars and functioning 100% offline!

---

## Method 2: Generate Signed APK via PWABuilder (Online in 2 Mins)

Microsoft's [PWABuilder](https://www.pwabuilder.com) packages the PWA into a signed Android `.apk` or `.aab` package ready for sideloading or Google Play Store.

1. **Host the dashboard**:
   - Push the `dashboard/` directory to a GitHub repository.
   - Enable **GitHub Pages** in Repo Settings > Pages, or deploy to Vercel/Netlify in 1 click.
2. Go to **[https://www.pwabuilder.com](https://www.pwabuilder.com)**.
3. Enter your dashboard URL (e.g., `https://your-username.github.io/prakashan-ai/`).
4. Click **"Start"** -> PWABuilder will validate the manifest and icons.
5. Click **"Package for Android"**.
6. Select **"APK"** or **"Package"** and click **Download**.
7. Copy the generated `.apk` file to your phone and tap to install!

---

## Method 3: Build APK using Capacitor (Recommended for Local Dev)

[Capacitor](https://capacitorjs.com/) converts your HTML/CSS/JavaScript into a native Android Studio project.

### Step 1: Open Terminal in the dashboard directory
```bash
cd prakshan_ai/dashboard
```

### Step 2: Initialize Node.js & Install Capacitor
```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 3: Initialize Capacitor Project
```bash
npx cap init "Prakashan AI" "com.prakashan.ai" --web-dir .
```

### Step 4: Add Android Platform
```bash
npx cap add android
```

### Step 5: Copy Web Assets & Open Android Studio
```bash
npx cap copy
npx cap open android
```

### Step 6: Build APK in Android Studio
1. Android Studio will launch the generated project.
2. In the top menu, go to: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. Once completed, click the **"locate"** link in the popup notification.
4. Your standalone APK is located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`
5. Transfer `app-debug.apk` to any Android device via USB/WhatsApp/Drive and tap to install.

---

## Method 4: Native Android Studio WebView Wrapper (Kotlin)

If you want a lightweight native Kotlin Android Studio project, use this template:

### `AndroidManifest.xml` (Permissions & USB OTG support)
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.prakashan.ai">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-feature android:name="android.hardware.usb.host" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@drawable/logo"
        android:label="Prakashan AI"
        android:roundIcon="@drawable/logo"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### `MainActivity.kt`
```kotlin
package com.prakashan.ai

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        webView.webViewClient = WebViewClient()

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        // Load local offline assets bundled in android assets/ folder
        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```

---

## 📱 Connecting Android Phone Directly to Arduino Uno via USB OTG

To connect your Android device directly to the Arduino Uno:
1. Use an inexpensive **USB-C to USB-A OTG Adapter** ($1.50).
2. Plug the standard Arduino USB cable into the OTG adapter connected to your Android phone.
3. Open **Prakashan AI** in Chrome on Android.
4. Tap **"Connect USB Serial"**.
5. Android will prompt: *"Allow Prakashan AI to access Arduino Uno?"* -> Tap **Allow**.
6. Telemetry streams instantly to the mobile app in real-time!
