#!/usr/bin/env python3
"""Menyesuaikan folder android/ hasil `flutter create` untuk aplikasi WebView ARTA PEDIA:
izin (internet, kamera, mikrofon, lokasi), nama aplikasi, tautan dalam (deep link), minSdk, dan id aplikasi.
Dijalankan dari folder android-app/ (otomatis oleh GitHub Actions). Aman dijalankan berulang."""
import os
import re
import sys
from urllib.parse import urlparse

SITE_URL = os.environ.get("SITE_URL", "https://artapedianokosmurahid.vercel.app")
HOST = urlparse(SITE_URL).hostname or "artapedianokosmurahid.vercel.app"
APP_ID = os.environ.get("APP_ID", "id.artapedia.app")
NAMA = os.environ.get("APP_NAMA", "ARTA PEDIA")

MANIFEST = "android/app/src/main/AndroidManifest.xml"
IZIN = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.VIBRATE",
]
FITUR_OPSIONAL = ["android.hardware.camera", "android.hardware.microphone", "android.hardware.location"]


def baca(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def tulis(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def manifest():
    if not os.path.exists(MANIFEST):
        sys.exit(f"Tidak ada {MANIFEST} — jalankan `flutter create --platforms=android .` dulu.")
    s = baca(MANIFEST)
    blok = ""
    for i in IZIN:
        if f'android:name="{i}"' not in s:
            blok += f'    <uses-permission android:name="{i}"/>\n'
    for ft in FITUR_OPSIONAL:
        if f'android:name="{ft}"' not in s:
            blok += f'    <uses-feature android:name="{ft}" android:required="false"/>\n'
    if blok:
        s = s.replace("<application", blok + "    <application", 1)
    s = re.sub(r'android:label="[^"]*"', f'android:label="{NAMA}"', s, count=1)
    if "usesCleartextTraffic" not in s:
        s = s.replace("<application", '<application android:usesCleartextTraffic="false"', 1)
    if 'android:host="%s"' % HOST not in s:
        filtre = (
            '            <intent-filter>\n'
            '                <action android:name="android.intent.action.VIEW"/>\n'
            '                <category android:name="android.intent.category.DEFAULT"/>\n'
            '                <category android:name="android.intent.category.BROWSABLE"/>\n'
            f'                <data android:scheme="https" android:host="{HOST}"/>\n'
            '            </intent-filter>\n'
        )
        s = s.replace("</activity>", filtre + "        </activity>", 1)
    if "<queries>" not in s:
        q = (
            "    <queries>\n"
            '        <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="https"/></intent>\n'
            '        <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="tg"/></intent>\n'
            '        <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="tel"/></intent>\n'
            '        <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="mailto"/></intent>\n'
            "    </queries>\n"
        )
        s = s.replace("</manifest>", q + "</manifest>", 1)
    tulis(MANIFEST, s)
    print("AndroidManifest.xml diperbarui")


def gradle():
    for nama in ("android/app/build.gradle.kts", "android/app/build.gradle"):
        if not os.path.exists(nama):
            continue
        s = baca(nama)
        s = re.sub(r"minSdk(Version)?\s*=?\s*flutter\.minSdkVersion", lambda m: f"minSdk{m.group(1) or ''} = 24" if nama.endswith(".kts") else f"minSdkVersion 24", s)
        s = re.sub(r'applicationId\s*=?\s*"[^"]+"', lambda m: f'applicationId = "{APP_ID}"' if nama.endswith(".kts") else f'applicationId "{APP_ID}"', s)
        tulis(nama, s)
        print(nama, "diperbarui (minSdk 24, applicationId", APP_ID + ")")
        return
    print("PERINGATAN: build.gradle(.kts) tidak ditemukan", file=sys.stderr)


if __name__ == "__main__":
    manifest()
    gradle()
