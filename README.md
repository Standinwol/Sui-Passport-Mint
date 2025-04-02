# 🧪 Sui Passport NFT Minter

![badge](https://img.shields.io/badge/Sui%20NFT-Minting-blueviolet?style=for-the-badge&logo=sui) ![power](https://img.shields.io/badge/Multithreaded-%E2%9A%99%EF%B8%8F-blue?style=for-the-badge) ![rocket](https://img.shields.io/badge/Auto-Minting-green?style=for-the-badge&logo=vercel)

A high-speed multi-threaded tool to **mint Sui Passport NFTs** automatically. Supports proxies, retries, logging, and concurrent execution.

> ⚠️ **Important:** Each wallet **must have at least 0.007 $SUI** available to cover minting fees.
---

## 🛠️ Clone Repository 

```bash
git clone https://github.com/RPC-Hubs/Sui-Passport-Mint.git
cd Sui-Passport-Mint
```

---

## ⚙️ Installation Guide 

### 🐧 For Linux/macOS:

1. **Install Node.js (v18 or later)**

```bash
sudo apt update
sudo apt install nodejs npm -y
node -v  # Ensure version is >= 18
```

2. **Install dependencies**

```bash
npm install
```

### 🪟 For Windows:

1. **Install Node.js**

- Download from: https://nodejs.org/en
- Install and ensure Node.js is available via:

```powershell
node -v  # Ensure version is >= 18
```

2. **Install dependencies**

```powershell
npm install
```

---

## 🔧 Configuration 

Prepare the following files in the root directory:

### 1. 🗝️ `priv.txt`
> Contains one private key per line
```
0xPrivateKey1
0xPrivateKey2
```

### 2. 🛡️ `proxies.txt` *(Optional)*
> One proxy per line, format:
```
http://user:pass@ip:port
```
If missing, tool will run without proxies.

### 3. ⚙️ `threads` config in `mint.js`

In `mint.js`, line 17, you can adjust the number of concurrent wallets processed:

```js
const CONFIG = {
    threads: 20, // 🔄 Number of concurrent threads (wallets processed in parallel)
    ...
};
```

#### 📊 Suggested Values:
| 🧮 Wallets | 🚀 Threads | 📝 Notes                         |
|------------|------------|----------------------------------|
| 1–10       | 2–5        | Small batch testing              |
| 10–100     | 10–20      | Medium batch, good proxies       |
| 100+       | 20–50      | High scale, rotating proxies     |

> ⚠️ **Tip:** If you encounter `429 Too Many Requests`, lower the thread count or use better proxies.

---

## 🧵 Run the Minter 

### Linux/macOS:
```bash
node mint.js
```

### Windows:
```powershell
node mint.js
```

---

## 🔍 Output 

- ✅ `success.txt`: Wallets that successfully minted NFT
- ❌ `fail.txt`: Wallets that failed after all retries

🧾 **Example Summary Table:**
```
+---------------+----------+------+--------------------------+
| Total Wallets | Success  | Fail | Output Files            |
+---------------+----------+------+--------------------------+
| 100           | 92       | 8    | success.txt, fail.txt   |
+---------------+----------+------+--------------------------+
```

---

## 🧰 Features 

- ⚡ Multi-threading with configurable `threads` count
- ♻️ Retry on failure (default: 5 times)
- 🕵️ Proxy rotation & rate limit handling
- 🎨 Colored logs and 📊 summary table

---

## 💡 Tips & Best Practices 🧙

- 🔁 Use fresh proxies to avoid bans
- 🧘 Start with fewer threads if facing rate limits
- 🧪 Always verify your private keys are valid Ed25519 Sui keys

---

## 🙋‍♂️ Community & Support

Join the team or get help here:

- 💬 [RPC Community Chat](https://t.me/chat_RPC_Community)  
- 📣 [RPC Hubs Channel](https://t.me/RPC_Hubs)  

---

## ❤️ Made with love by the RPC Hubs Team