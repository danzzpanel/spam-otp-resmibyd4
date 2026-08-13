# Spam OTP Web

Multi-platform OTP sender berbasis web dengan 16 endpoint.

## Fitur

- 🎨 **Dark theme UI** — responsive mobile & desktop
- 📱 **Auto-normalize** — format nomor otomatis (`08xxx`, `+62xxx`, `8xxx` → `628xxx`)
- ⚡ **Real-time** — SSE streaming, lihat hasil per-endpoint live
- 📊 **Stats** — progress bar + counter sukses/gagal
- 🎯 **16 Endpoints** — Maulagi, Matahari, Pinhome, Alodokter, Indodax, dll

## Install

```bash
npm install
```

## Run

```bash
PORT=9876 node server.js
```

Buka `http://localhost:9876`

## Cara Pakai

1. Buka di browser
2. Masukkan nomor telepon (format bebas)
3. Klik **Kirim OTP**
4. Lihat hasil real-time per platform

## Tech Stack

- Node.js + Express
- SSE (Server-Sent Events) untuk real-time update
- Axios untuk HTTP requests
- Vanilla HTML/CSS/JS frontend
