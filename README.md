# Jaine Auto Bot 🚀

![Jaine Auto Bot Banner](https://img.shields.io/badge/Jaine%20Auto%20Bot-v1.0-blueviolet?style=for-the-badge&logo=ethereum)  
**A powerful and user-friendly automated token swapping bot for the 0G Labs Galileo Testnet 🌌**

Welcome to **Jaine Auto Bot**, an advanced decentralized finance (DeFi) tool designed to automate token swaps for multiple trading pairs on the 0G Labs Galileo Testnet. Whether you're swapping USDT, ETH, BTC, GIMO, or STOG, Jaine Auto Bot simplifies the precision and efficiency you need for your DeFi endeavors! 💸

## 📢 Join Our Thriving Telegram Community! 🚀

Dive into the heart of the Jaine Auto Bot community on **Telegram**! Connect with fellow traders, share strategies, get real-time updates, and receive dedicated support. Our vibrant group is the perfect place to stay in the loop and level up your DeFi game! 🌟

👉 **[Join the Official Jaine Auto Bot Telegram](https://t.me/Offical_Im_kazuha)** 👈  
📩 Ask questions, share feedback, and be part of our growing DeFi family!  
🎉 Exclusive announcements, trading tips, and community events await you!

---

## Table of Contents 📑

- [Features](#-features)
- [Supported Token Pairs](#-supported-token-pairs)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Credits](#-credits)
- [Community](#-community)
- [License](#-license)

---

## ✨ Features

- **Multi-Pair Swapping**: Supports 12 unique token swap pairs, including `Auto All` mode for comprehensive trading. 🔄
- **User-Friendly Interface**: Choose from Normal, Low, or High (3) gas fee options with real-time feedback. ⛽
- **Balance Dashboard**: Displays wallet balances for OG, ETH, USDT, BTC, GIMO, and STOG in a clean format. 📊
- **Automated Transaction Queue**: Manages transactions smoothly to prevent conflicts and ensure reliable execution. 🛠️
- **Error Handling**: Robust nonce recovery and balance checks to keep your bot running seamlessly. 🛡️
- **Spinner Animations**: Engaging console output with color-coded logs and spinner animations for a polished experience. 🎨
- **Hardcoded Configs**: Eliminates the need for a `.env` file, with secure private key storage in `pv.txt`. 🔐

---

## 💰 Supported Token Pairs

Jaine Auto Bot supports the following trading pairs, enabling flexible trading strategies:

1. **USDT ↔ ETH**
2. **USDT ↔ BTC**
3. **BTC ↔ ETH**
4. **USDT ↔ GIMO**
5. USDT ↔ **STOG**
6. **BTC ↔ USDT**
7. **ETH ↔ USDT**
8. **ETH ↔ BTC**
9. **ETH ↔ GIMO**
10. **BTC ↔ GIMO**
11. **ETH ↔ STOG**
12. **BTC ↔ STOG**

Use the `Auto All` option to cycle through all pairs automatically! 🌍

---

## 🛠️ Prerequisites

Before running Jaine Auto Bot, ensure you have the following:

- **Node.js**: Version 18.x or higher (tested on v22.11.0) 📦
  - [Download Node.js](https://nodejs.org/)
- **Git**: To clone the repository
  - [Install Git](https://git-scm.com/)
- **Wallet**: An Ethereum-compatible wallet with funds on the 0G Labs Galileo Testnet
- **Private Key**: Stored securely in a `pv.txt` file
- **Dependencies**: Access to the 0G Labs Galileo Testnet network

---

## 🚀 Installation

Follow these steps to set up Jaine Auto Bot on your local machine:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Kazuha787/Jaine-Auto-Bot.git
   cd Jaine-Auto-Bot
   ```

2. **Install Dependencies**:
   Install the required Node.js packages:
   ```bash
   npm install
   ```

3. **Verify Installation**:
   Ensure all dependencies (`ethers`, `chalk`) are installed correctly. Check `package.json` for details.

---

## 🔐 Configuration

Jaine Auto Bot eliminates the need for a `.env` file by hardcoding all configuration variables directly in `C3.js`. You only need to configure your private key:

1. **Create `pv.txt`**:
   - Create a file named `pv.txt` in the your project root directory.
   - Add your private key (64-character hexadecimal string starting with `0x`):
     ```plaintext
     0xYourPrivateKeyHere
     ```

2. **Example `pv.txt`**:
   ```plaintext
   0x3783034a4516c92080ed56b
   ```

3. **Hardcoded Configurations**:
   The following are predefined in `index.js`:
   - **RPC URL**: `https://evmrpc-testnet.0g.ai/`
   - **BTC Address**: `0x36f6414FF1cf609214dDAbA71c84f18bcf00F67d`
   - **GIMO Address**: `0xba2aE6c8cddd628a087D7e43C1Ba9844c5Bf9638`
   - **STOG Address**: `0x14d2F76020c1ECb29BcD673B51d8026C6836a66A`

**⚠️ Keep `pv.txt` secure and never commit it to version control!**

---

## 📈 Usage

Run Jaine Auto Bot and interact with its intuitive menu:

1. **Start the Bot**:
   ```bash
   node index.js
   ```

2. **Menu Options**:
   - **1. Check Wallet Balance**: View your wallet balances for all supported tokens.
   - **2-13. Auto Swap for Specific Pairs**: Select a trading pair (e.g., USDT & ETH) and specify the number of swaps.
   - **14. Auto All**: Run swaps for all pairs sequentially.
   - **15. Exit**: Close the bot.

3. **Gas Fee Selection**:
   - Choose from **Normal**, **Low**, or **High** gas fees for each swap session.
   - Gas fees are displayed in Gneuron for transparency.

4. **Example Interaction**:
   ```
   Select an option (1-15): 2
   Enter number of swaps: 5
   Selected gas fee: 10.5 Gneuron
   Starting USDT & ETH for 5 swaps...
   Transaction [1] completed
   ```

5. **Logs and Animations**:
   - Color-coded logs (green for success, red for errors) and spinner animations keep you informed.

---

## 📂 Project Structure

Understand the layout of Jaine Auto Bot:

```
Jaine-Auto-Bot/
├── index.js              # Main script for the bot
├── pv.txt                # Private key file (create manually)
├── package.json          # Node.js dependencies
├── node_modules/         # Installed dependencies
└── README.md             # Project documentation
```

---

## 🤝 Contributing

We welcome contributions to make Jaine Auto Bot even better! 🌟

1. **Fork the Repository**:
   ```bash
   git fork https://github.com/Kazuha787/Jaine-Auto-Bot.git
   ```

2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Commit Changes**:
   ```bash
   git commit -m "Add your feature"
   ```

4. **Push and Create a Pull Request**:
   ```bash
   git push origin feature/your-feature
   ```

5. **Follow Guidelines**:
   - Ensure code is well-documented.
   - Test thoroughly on the 0G Labs Galileo Testnet.
   - Join our [Telegram](https://t.me/Offical_Im_kazuha) to discuss your ideas!

---

## 🙌 Credits

A big thank you to the following:

- **Kazuha787**: Project creator and lead developer 🧑‍💻
- **0G Labs**: For providing the Galileo Testnet infrastructure 🌐
- **Ethers.js**: For powering blockchain interactions 📚
- **Chalk**: For colorful console output 🎨
- **Community**: To all users and contributors on [Telegram](https://t.me/Offical_Im_kazuha) 🙏

Special thanks to the DeFi community for inspiring this project! 💖

---

## 🌐 Community

Join our growing community to stay updated, ask questions, and share your experiences:

- **Telegram**: [Official Im Kazuha](https://t.me/Offical_Im_kazuha) 📩
- **GitHub**: [Kazuha787/Jaine-Auto-Bot](https://github.com/Kazuha787/Jaine-Auto-Bot) ⭐
- **Issues**: Report bugs or suggest features on [GitHub Issues](https://github.com/Kazuha787/Jaine-Auto-Bot/issues) 🐞

Follow us on Telegram for real-time updates, trading tips, and exclusive announcements! 🚨

---

## 📜 License

Jaine Auto Bot is licensed under the [MIT License](LICENSE). Feel free to use, modify, and distribute the code, but please give credit to the original author. 📝

---

**Happy Swapping with Jaine Auto Bot!** 🤑  
Made with ❤️ by [Kazuha787](https://github.com/Kazuha787)  
Join us on [Telegram](https://t.me/Offical_Im_kazuha) and star the repo on [GitHub](https://github.com/Kazuha787/Jaine-Auto-Bot)! 🌟

---

### Notes on the README
1. **Structure**: Organized into clear sections with a table of contents for easy navigation.
2. **Emojis**: Used emojis to enhance visual appeal and highlight key points.
3. **Details**: Includes comprehensive setup, configuration, and usage instructions tailored to the `C3.js` script provided earlier.
4. **Security**: Emphasizes securing `pv.txt` and avoiding version control for sensitive data.
5. **Community**: Promotes the Telegram group (`https://t.me/Offical_Im_kazuha`) and GitHub repository (`https://github.com/Kazuha787/Jaine-Auto-Bot.git`).
6. **Credits**: Acknowledges the user (Kazuha787), dependencies, and the community.
7. **Visuals**: Incorporates badges and formatted code blocks for clarity.
8. **License**: References an MIT License (assumed; user can create a `LICENSE` file if needed).

To use this README:
- Create a `README.md` file in the root of your repository.
- Copy and paste the above content.
- Ensure a `LICENSE` file exists if referencing the MIT License, or update the license section accordingly.
- Optionally, add a banner image or logo by hosting it (e.g., on GitHub or an image hosting service) and updating the badge URL.

If you need further tweaks or additional sections, let me know! 😊
