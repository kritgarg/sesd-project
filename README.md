<div align="center">
  <img src="frontend/app/icon.png" width="150" style="border-radius: 20px; border: 4px solid #FFE600" />
  
  # ⚡ SWIFTSHARE

  **Direct, secure, blazing-fast P2P file transferring.**  
  No uploads. No limits. Just instant secure file sharing.

  <br />
</div>

## 🟨 What is SwiftShare?
SwiftShare is a **premium, brutalist-style** peer-to-peer file transfer platform. Designed for speed, security, and aesthetics, it utilizes WebRTC so files flow *directly* from the sender to the receiver. No intermediate servers store your data. It's safe, private, and incredibly fast. 

## ⬛ Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend / Signaling**: Node.js, Express.js, Socket.IO (Simple Peer implementation)
- **Transfer Engine**: Advanced WebRTC (P2P Data Channel logic handling blobs in chunks)
- **Design System**: Brutalist Aesthetic (Oswald + Permanent Marker typography, high-impact `#FFE600` styling)

## 🟨 How to Run Locally

### 1. Start the Backend Server (Signaling)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
*(The backend defaults to port `4000`)*

### 2. Start the Frontend Application
1. Open a new terminal tab and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
*(The frontend defaults to port `3000`)*

### 3. Usage Requirements
- Open [http://localhost:3000](http://localhost:3000)
- **IMPORTANT**: P2P transfers require the **Sender and Receiver to be on the same WiFi network** (or utilize proper TURN server setups). Keep the window open until the transfer completely finalizes!

---
> Designed with 🖤 and 💛 by Krit Garg.
