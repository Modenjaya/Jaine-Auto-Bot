const { ethers } = require("ethers");
const chalk = require("chalk");
const greenChalk = chalk.green; 
const fs = require("fs");

// Hardcoded environment variables from provided .env
const RPC_URL = "https://evmrpc-testnet.0g.ai/";
const ROUTER_ADDRESS = "0xb95B5953FF8ee5D5d9818CdbEfE363ff2191318c";
const USDT_ADDRESS = "0x3eC8A8705bE1D5ca90066b37ba62c4183B024ebf";
const ETH_ADDRESS = "0x0fE9B43625fA7EdD663aDcEC0728DD635e4AbF7c";
const BTC_ADDRESS = "0x36f6414FF1df609214dDAbA71c84f18bcf00F67d";
const GIMO_ADDRESS = "0xba2aE6c8cddd628a087D7e43C1Ba9844c5Bf9638";
const STOG_ADDRESS = "0x14d2F76020c1ECb29BcD673B51d8026C6836a66A";
const NETWORK_NAME = "OG LABS GALILEO TESTNET";
const EXPLORER_URL = "https://chainscan-galileo.0g.ai/tx/";
const APPROVAL_GAS_LIMIT = 100000;
const SWAP_GAS_LIMIT = 150000;

// --- MODIFIKASI: Membaca MULTIPLE private keys dari pv.txt ---
let PRIVATE_KEYS = [];
try {
  const fileContent = fs.readFileSync("pv.txt", "utf8").trim();
  PRIVATE_KEYS = fileContent.split('\n')
                            .map(line => line.trim())
                            .filter(line => line && line.match(/^0x[0-9a-fA-F]{64}$/));

  if (PRIVATE_KEYS.length === 0) {
    console.error("Invalid or missing private keys in pv.txt. Ensure each key is a 64-character hexadecimal string starting with 0x on a new line.");
    process.exit(1);
  } else {
    console.log(chalk.green(`Successfully loaded ${PRIVATE_KEYS.length} private key(s) from pv.txt.`));
  }
} catch (error) {
  console.error(`Failed to read pv.txt: ${error.message}`);
  process.exit(1);
}

// Validate hardcoded variables
if (!RPC_URL || !ROUTER_ADDRESS || !USDT_ADDRESS || !ETH_ADDRESS || !BTC_ADDRESS || !GIMO_ADDRESS || !STOG_ADDRESS || !NETWORK_NAME) {
  console.error("Missing required hardcoded variables in script");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
// --- MODIFIKASI: Membuat array of wallets ---
const wallets = PRIVATE_KEYS.map(pk => new ethers.Wallet(pk, provider));

const CONTRACT_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint256", name: "amountOutMinimum", type: "uint256" },
          { internalType: "uint160", name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        internalType: "struct ISwapRouter.ExactInputSingleParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
];

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const USDT_ABI = ERC20_ABI;
const ETH_ABI = ERC20_ABI;
const BTC_ABI = ERC20_ABI;
const GIMO_ABI = ERC20_ABI;
const STOG_ABI = ERC20_ABI;

// --- MODIFIKASI: Mengelola nonce per akun ---
let accountNonces = {}; 

let transactionQueue = [];
let transactionIdCounter = 0;
let selectedGasPrice = null;

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function interruptibleDelay(totalMs) {
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = 200;
  let elapsed = 0;
  while (elapsed < totalMs) {
    process.stdout.write(`\r${centerText(`${spinner[i % spinner.length]} Waiting ${totalMs / 1000} seconds...`, 80)}`);
    await delay(interval);
    elapsed += interval;
    i++;
  }
  process.stdout.write("\r" + " ".repeat(80) + "\r");
}

function centerText(text, width = 80) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

// --- MODIFIKASI: Menambahkan address ke log message ---
function log(message, type = "info") {
  const centeredMessage = centerText(message);
  if (type === "success") {
    console.log(chalk.green(centeredMessage));
  } else if (type === "error") {
    console.log(chalk.red(centeredMessage));
  } else if (type === "warning") {
    console.log(chalk.yellow(centeredMessage));
  } else if (type === "system") {
    console.log(chalk.blue(centeredMessage));
  } else {
    console.log(chalk.white(centeredMessage));
  }
}

function showBanner() {
  const banner = [
    "════════════════════════════════════════════════════════════",
    "       ----  Jaine Auto Swap Bot - v1.0  ----         ",
    "               LETS FUCK THIS Testnet                 ",
    "     CREATED BY KAZUHA - Powered by 0G Labs Testnet     ",
    "════════════════════════════════════════════════════════════",
  ];
  banner.forEach((line) => console.log(chalk.cyan(centerText(line))));
}

// --- MODIFIKASI: updateWalletData sekarang mengulang semua wallet ---
async function updateWalletData() {
  log("══════════════════════ Wallet Balances ══════════════════════", "system");
  for (const walletInstance of wallets) { // Iterasi setiap wallet
    try {
      const walletAddress = walletInstance.address;
      const balanceNative = await provider.getBalance(walletAddress);
      const saldoAOGI = parseFloat(ethers.formatEther(balanceNative)).toFixed(4);

      const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
      const balanceUSDT = await usdtContract.balanceOf(walletAddress);
      const saldoUSDT = parseFloat(ethers.formatEther(balanceUSDT)).toFixed(4);

      const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
      const balanceETH = await ethContract.balanceOf(walletAddress);
      const saldoETH = parseFloat(ethers.formatEther(balanceETH)).toFixed(4);

      const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
      const balanceBTC = await btcContract.balanceOf(walletAddress);
      const saldoBTC = parseFloat(ethers.formatUnits(balanceBTC, 18)).toFixed(4);

      const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
      const balanceGIMO = await gimoContract.balanceOf(walletAddress);
      const saldoGIMO = parseFloat(ethers.formatUnits(balanceGIMO, 18)).toFixed(4);

      const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
      const balanceSTOG = await stogContract.balanceOf(walletAddress);
      const saldoSTOG = parseFloat(ethers.formatUnits(balanceSTOG, 18)).toFixed(4);

      log(`Wallet Address: ${walletAddress}`, "system");
      log(`OG Balance: ${saldoAOGI}`, "success");
      log(`ETH Balance: ${saldoETH}`, "success");
      log(`USDT Balance: ${saldoUSDT}`, "success");
      log(`BTC Balance: ${saldoBTC}`, "success");
      log(`GIMO Balance: ${saldoGIMO}`, "success");
      log(`STOG Balance: ${saldoSTOG}`, "success");
      log("----------------------------------------------------------------", "system");
    } catch (error) {
      log(`Failed to update wallet data for ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
  }
  log(`Network: ${NETWORK_NAME}`, "system");
  log("══════════════════════════════════════════════════════════════", "system");
}

// --- MODIFIKASI: approveToken menerima walletInstance ---
async function approveToken(walletInstance, tokenAddress, tokenAbi, amount) {
  try {
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, walletInstance); // Gunakan walletInstance
    const currentAllowance = await tokenContract.allowance(walletInstance.address, ROUTER_ADDRESS);
    if (currentAllowance >= amount) {
      log(`[${walletInstance.address.substring(0, 8)}...] Approval already sufficient`, "system");
      return;
    }
    const feeData = await provider.getFeeData();
    const tx = await tokenContract.approve(ROUTER_ADDRESS, amount, {
      gasLimit: APPROVAL_GAS_LIMIT,
      gasPrice: selectedGasPrice || feeData.gasPrice,
      nonce: await getNonceForWallet(walletInstance) // Menggunakan fungsi nonce kustom
    });
    log(`[${walletInstance.address.substring(0, 8)}...] Approval transaction sent: ${EXPLORER_URL}${tx.hash}`, "system");
    const interval = setInterval(() => {
      process.stdout.write(`\r${centerText(`${spinner[i % spinner.length]} Waiting for approval (${walletInstance.address.substring(0, 6)})...`, 80)}`);
      i++;
    }, 200);
    await tx.wait();
    clearInterval(interval);
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    log(`[${walletInstance.address.substring(0, 8)}...] Approval successful`, "success");
  } catch (error) {
    log(`[${walletInstance.address.substring(0, 8)}...] Approval failed: ${error.message}`, "error");
    throw error;
  }
}

// --- MODIFIKASI: swapAuto menerima walletInstance ---
async function swapAuto(walletInstance, direction, amountIn) {
  try {
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const swapContract = new ethers.Contract(ROUTER_ADDRESS, CONTRACT_ABI, walletInstance); // Gunakan walletInstance
    let params;
    const deadline = Math.floor(Date.now() / 1000) + 120;
    
    // Log pesan swap yang lebih spesifik
    let logMessage = `[${walletInstance.address.substring(0, 8)}...] Starting swap `;

    if (direction === "usdtToEth") {
      logMessage += `USDT to ETH: ${ethers.formatUnits(amountIn, 18)} USDT`;
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address, // Penting: recipient adalah alamat walletInstance
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToUsdt") {
      logMessage += `ETH to USDT: ${ethers.formatUnits(amountIn, 18)} ETH`;
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "usdtToBtc") {
      logMessage += `USDT to BTC: ${ethers.formatUnits(amountIn, 18)} USDT`;
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToUsdt") {
      logMessage += `BTC to USDT: ${ethers.formatUnits(amountIn, 18)} BTC`;
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToEth") {
      logMessage += `BTC to ETH: ${ethers.formatUnits(amountIn, 18)} BTC`;
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToBtc") {
      logMessage += `ETH to BTC: ${ethers.formatUnits(amountIn, 18)} ETH`;
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "usdtToGimo") {
      logMessage += `USDT to GIMO: ${ethers.formatUnits(amountIn, 18)} USDT`;
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: GIMO_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "gimoToUsdt") {
      logMessage += `GIMO to USDT: ${ethers.formatUnits(amountIn, 18)} GIMO`;
      params = {
        tokenIn: GIMO_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "usdtToStog") {
      logMessage += `USDT to STOG: ${ethers.formatUnits(amountIn, 18)} USDT`;
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: STOG_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "stogToUsdt") {
      logMessage += `STOG to USDT: ${ethers.formatUnits(amountIn, 18)} STOG`;
      params = {
        tokenIn: STOG_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToGimo") {
      logMessage += `ETH to GIMO: ${ethers.formatUnits(amountIn, 18)} ETH`;
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: GIMO_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "gimoToEth") {
      logMessage += `GIMO to ETH: ${ethers.formatUnits(amountIn, 18)} GIMO`;
      params = {
        tokenIn: GIMO_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToGimo") {
      logMessage += `BTC to GIMO: ${ethers.formatUnits(amountIn, 18)} BTC`;
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: GIMO_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "gimoToBtc") {
      logMessage += `GIMO to BTC: ${ethers.formatUnits(amountIn, 18)} GIMO`;
      params = {
        tokenIn: GIMO_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToStog") {
      logMessage += `ETH to STOG: ${ethers.formatUnits(amountIn, 18)} ETH`;
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: STOG_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "stogToEth") {
      logMessage += `STOG to ETH: ${ethers.formatUnits(amountIn, 18)} STOG`;
      params = {
        tokenIn: STOG_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToStog") {
      logMessage += `BTC to STOG: ${ethers.formatUnits(amountIn, 18)} BTC`;
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: STOG_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "stogToBtc") {
      logMessage += `STOG to BTC: ${ethers.formatUnits(amountIn, 18)} STOG`;
      params = {
        tokenIn: STOG_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: walletInstance.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else {
      throw new Error("Unknown swap direction");
    }
    log(logMessage, "system"); // Log pesan yang sudah dibuat

    const gasPriceToUse = selectedGasPrice || (await provider.getFeeData()).gasPrice;
    const tx = await swapContract.exactInputSingle(params, {
      gasLimit: SWAP_GAS_LIMIT,
      gasPrice: gasPriceToUse,
      nonce: await getNonceForWallet(walletInstance) // Menggunakan fungsi nonce kustom
    });
    log(`[${walletInstance.address.substring(0, 8)}...] Swap transaction sent: ${EXPLORER_URL}${tx.hash}`, "warning");
    const interval = setInterval(() => {
      process.stdout.write(`\r${centerText(`${spinner[i % spinner.length]} Waiting for transaction (${walletInstance.address.substring(0, 6)})...`, 80)}`);
      i++;
    }, 200);
    const receipt = await tx.wait();
    clearInterval(interval);
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    log(`[${walletInstance.address.substring(0, 8)}...] Swap transaction successful: ${EXPLORER_URL}${tx.hash}`, "success");
    const feeAOGI = ethers.formatEther(receipt.gasUsed * gasPriceToUse);
    log(`[${walletInstance.address.substring(0, 8)}...] Transaction fee: ${feeAOGI} OG`, "success");
  } catch (error) {
    // --- MODIFIKASI: Penanganan nonce error yang lebih spesifik ---
    if (error.message && error.message.toLowerCase().includes("nonce")) {
      // Refresh nonce untuk akun spesifik yang mengalami masalah
      accountNonces[walletInstance.address] = await provider.getTransactionCount(walletInstance.address, "pending");
      log(`[${walletInstance.address.substring(0, 8)}...] Nonce refreshed: ${accountNonces[walletInstance.address]}`, "system");
    }
    log(`[${walletInstance.address.substring(0, 8)}...] Swap ${direction} failed: ${error.message}`, "error");
    throw error;
  }
}

// --- MODIFIKASI: Fungsi untuk mendapatkan nonce per akun ---
async function getNonceForWallet(walletInstance) {
  if (accountNonces[walletInstance.address] === undefined) {
    accountNonces[walletInstance.address] = await provider.getTransactionCount(walletInstance.address, "pending");
  }
  const currentNonce = accountNonces[walletInstance.address];
  accountNonces[walletInstance.address]++; // Increment nonce untuk transaksi berikutnya
  return currentNonce;
}


// --- MODIFIKASI: Fungsi autoSwap sekarang mengulang semua akun ---
async function autoSwapUsdtEth(totalSwaps) {
  log("Starting USDT & ETH swaps for all accounts...", "system");
  for (const walletInstance of wallets) { // Iterasi setiap wallet
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing USDT & ETH swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
            const usdtAmount = ethers.parseUnits(randomUsdt, 18);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
            const currentUsdtBalance = await usdtContract.balanceOf(walletInstance.address);
            if (currentUsdtBalance < usdtAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
              continue; // Lanjut ke swap berikutnya untuk akun ini atau akun berikutnya
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, USDT_ADDRESS, USDT_ABI, usdtAmount);
              await swapAuto(walletInstance, "usdtToEth", usdtAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] USDT to ETH, ${randomUsdt} USDT`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap USDT to ETH error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
            const ethAmount = ethers.parseUnits(randomEth, 18);
            const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
            const currentEthBalance = await ethContract.balanceOf(walletInstance.address);
            if (currentEthBalance < ethAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, ETH_ADDRESS, ETH_ABI, ethAmount);
              await swapAuto(walletInstance, "ethToUsdt", ethAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] ETH to USDT, ${randomEth} ETH`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap ETH to USDT error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All USDT & ETH swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapUsdtEth for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system"); // Pemisah antar akun
    await interruptibleDelay(5000); // Tunggu antar akun
  }
  log("All USDT & ETH swaps completed for ALL accounts", "success");
  return true;
}

// --- MODIFIKASI: Duplikat dan adaptasi untuk semua fungsi autoSwap lainnya ---
// Anda perlu melakukan hal yang sama untuk setiap fungsi autoSwap lainnya (misalnya autoSwapUsdtBtc, autoSwapBtcEth, dst.)
// Pastikan mereka juga mengulang `for (const walletInstance of wallets)` dan memanggil `approveToken(walletInstance, ...)` serta `swapAuto(walletInstance, ...)`

async function autoSwapUsdtBtc(totalSwaps) {
  log("Starting USDT & BTC swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing USDT & BTC swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
            const usdtAmount = ethers.parseUnits(randomUsdt, 18);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
            const currentUsdtBalance = await usdtContract.balanceOf(walletInstance.address);
            if (currentUsdtBalance < usdtAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, USDT_ADDRESS, USDT_ABI, usdtAmount);
              await swapAuto(walletInstance, "usdtToBtc", usdtAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] USDT to BTC, ${randomUsdt} USDT`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap USDT to BTC error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
            const btcAmount = ethers.parseUnits(randomBtc, 18);
            const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
            const currentBtcBalance = await btcContract.balanceOf(walletInstance.address);
            if (currentBtcBalance < btcAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, BTC_ADDRESS, BTC_ABI, btcAmount);
              await swapAuto(walletInstance, "btcToUsdt", btcAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] BTC to USDT, ${randomBtc} BTC`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap BTC to USDT error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All USDT & BTC swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapUsdtBtc for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All USDT & BTC swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapBtcEth(totalSwaps) {
  log("Starting BTC & ETH swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing BTC & ETH swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomBtc = (Math.random() * (0.05 - 0.01) + 0.01).toFixed(6);
            const btcAmount = ethers.parseUnits(randomBtc, 18);
            const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
            const currentBtcBalance = await btcContract.balanceOf(walletInstance.address);
            if (currentBtcBalance < btcAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, BTC_ADDRESS, BTC_ABI, btcAmount);
              await swapAuto(walletInstance, "btcToEth", btcAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] BTC to ETH, ${randomBtc} BTC`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap BTC to ETH error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
            const ethAmount = ethers.parseUnits(randomEth, 18);
            const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
            const currentEthBalance = await ethContract.balanceOf(walletInstance.address);
            if (currentEthBalance < ethAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, ETH_ADDRESS, ETH_ABI, ethAmount);
              await swapAuto(walletInstance, "ethToBtc", ethAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] ETH to BTC, ${randomEth} ETH`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap ETH to BTC error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All BTC & ETH swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapBtcEth for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All BTC & ETH swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapUsdtGimo(totalSwaps) {
  log("Starting USDT & GIMO swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing USDT & GIMO swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
            const usdtAmount = ethers.parseUnits(randomUsdt, 18);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
            const currentUsdtBalance = await usdtContract.balanceOf(walletInstance.address);
            if (currentUsdtBalance < usdtAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, USDT_ADDRESS, USDT_ABI, usdtAmount);
              await swapAuto(walletInstance, "usdtToGimo", usdtAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] USDT to GIMO, ${randomUsdt} USDT`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap USDT to GIMO error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomGimo = (Math.random() * (1000 - 100) + 100).toFixed(2);
            const gimoAmount = ethers.parseUnits(randomGimo, 18);
            const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
            const currentGimoBalance = await gimoContract.balanceOf(walletInstance.address);
            if (currentGimoBalance < gimoAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient GIMO balance: ${ethers.formatUnits(currentGimoBalance, 18)} GIMO`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, GIMO_ADDRESS, GIMO_ABI, gimoAmount);
              await swapAuto(walletInstance, "gimoToUsdt", gimoAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] GIMO to USDT, ${randomGimo} GIMO`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap GIMO to USDT error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All USDT & GIMO swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapUsdtGimo for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All USDT & GIMO swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapUsdtStog(totalSwaps) {
  log("Starting USDT & STOG swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing USDT & STOG swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
            const usdtAmount = ethers.parseUnits(randomUsdt, 18);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
            const currentUsdtBalance = await usdtContract.balanceOf(walletInstance.address);
            if (currentUsdtBalance < usdtAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, USDT_ADDRESS, USDT_ABI, usdtAmount);
              await swapAuto(walletInstance, "usdtToStog", usdtAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] USDT to STOG, ${randomUsdt} USDT`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap USDT to STOG error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomStog = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
            const stogAmount = ethers.parseUnits(randomStog, 18);
            const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
            const currentStogBalance = await stogContract.balanceOf(walletInstance.address);
            if (currentStogBalance < stogAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient STOG balance: ${ethers.formatUnits(currentStogBalance, 18)} STOG`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, STOG_ADDRESS, STOG_ABI, stogAmount);
              await swapAuto(walletInstance, "stogToUsdt", stogAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] STOG to USDT, ${randomStog} STOG`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap STOG to USDT error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All USDT & STOG swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapUsdtStog for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All USDT & STOG swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapBtcUsdt(totalSwaps) {
  log("Starting BTC & USDT swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing BTC & USDT swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
            const btcAmount = ethers.parseUnits(randomBtc, 18);
            const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
            const currentBtcBalance = await btcContract.balanceOf(walletInstance.address);
            if (currentBtcBalance < btcAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, BTC_ADDRESS, BTC_ABI, btcAmount);
              await swapAuto(walletInstance, "btcToUsdt", btcAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] BTC to USDT, ${randomBtc} BTC`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap BTC to USDT error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
            const usdtAmount = ethers.parseUnits(randomUsdt, 18);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
            const currentUsdtBalance = await usdtContract.balanceOf(walletInstance.address);
            if (currentUsdtBalance < usdtAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, USDT_ADDRESS, USDT_ABI, usdtAmount);
              await swapAuto(walletInstance, "usdtToBtc", usdtAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] USDT to BTC, ${randomUsdt} USDT`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap USDT to BTC error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All BTC & USDT swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapBtcUsdt for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All BTC & USDT swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapEthUsdt(totalSwaps) {
  log("Starting ETH & USDT swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing ETH & USDT swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
            const ethAmount = ethers.parseUnits(randomEth, 18);
            const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
            const currentEthBalance = await ethContract.balanceOf(walletInstance.address);
            if (currentEthBalance < ethAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, ETH_ADDRESS, ETH_ABI, ethAmount);
              await swapAuto(walletInstance, "ethToUsdt", ethAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] ETH to USDT, ${randomEth} ETH`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap ETH to USDT error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
            const usdtAmount = ethers.parseUnits(randomUsdt, 18);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
            const currentUsdtBalance = await usdtContract.balanceOf(walletInstance.address);
            if (currentUsdtBalance < usdtAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, USDT_ADDRESS, USDT_ABI, usdtAmount);
              await swapAuto(walletInstance, "usdtToEth", usdtAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] USDT to ETH, ${randomUsdt} USDT`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap USDT to ETH error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All ETH & USDT swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapEthUsdt for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All ETH & USDT swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapEthBtc(totalSwaps) {
  log("Starting ETH & BTC swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing ETH & BTC swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
            const ethAmount = ethers.parseUnits(randomEth, 18);
            const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
            const currentEthBalance = await ethContract.balanceOf(walletInstance.address);
            if (currentEthBalance < ethAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, ETH_ADDRESS, ETH_ABI, ethAmount);
              await swapAuto(walletInstance, "ethToBtc", ethAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] ETH to BTC, ${randomEth} ETH`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap ETH to BTC error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomBtc = (Math.random() * (0.05 - 0.01) + 0.01).toFixed(6);
            const btcAmount = ethers.parseUnits(randomBtc, 18);
            const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
            const currentBtcBalance = await btcContract.balanceOf(walletInstance.address);
            if (currentBtcBalance < btcAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, BTC_ADDRESS, BTC_ABI, btcAmount);
              await swapAuto(walletInstance, "btcToEth", btcAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] BTC to ETH, ${randomBtc} BTC`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap BTC to ETH error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All ETH & BTC swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapEthBtc for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All ETH & BTC swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapEthGimo(totalSwaps) {
  log("Starting ETH & GIMO swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing ETH & GIMO swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
            const ethAmount = ethers.parseUnits(randomEth, 18);
            const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
            const currentEthBalance = await ethContract.balanceOf(walletInstance.address);
            if (currentEthBalance < ethAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, ETH_ADDRESS, ETH_ABI, ethAmount);
              await swapAuto(walletInstance, "ethToGimo", ethAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] ETH to GIMO, ${randomEth} ETH`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap ETH to GIMO error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomGimo = (Math.random() * (1000 - 100) + 100).toFixed(2);
            const gimoAmount = ethers.parseUnits(randomGimo, 18);
            const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
            const currentGimoBalance = await gimoContract.balanceOf(walletInstance.address);
            if (currentGimoBalance < gimoAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient GIMO balance: ${ethers.formatUnits(currentGimoBalance, 18)} GIMO`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, GIMO_ADDRESS, GIMO_ABI, gimoAmount);
              await swapAuto(walletInstance, "gimoToEth", gimoAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] GIMO to ETH, ${randomGimo} GIMO`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap GIMO to ETH error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All ETH & GIMO swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapEthGimo for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All ETH & GIMO swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapBtcGimo(totalSwaps) {
  log("Starting BTC & GIMO swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing BTC & GIMO swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
            const btcAmount = ethers.parseUnits(randomBtc, 18);
            const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
            const currentBtcBalance = await btcContract.balanceOf(walletInstance.address);
            if (currentBtcBalance < btcAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, BTC_ADDRESS, BTC_ABI, btcAmount);
              await swapAuto(walletInstance, "btcToGimo", btcAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] BTC to GIMO, ${randomBtc} BTC`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap BTC to GIMO error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomGimo = (Math.random() * (1000 - 100) + 100).toFixed(2);
            const gimoAmount = ethers.parseUnits(randomGimo, 18);
            const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
            const currentGimoBalance = await gimoContract.balanceOf(walletInstance.address);
            if (currentGimoBalance < gimoAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient GIMO balance: ${ethers.formatUnits(currentGimoBalance, 18)} GIMO`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, GIMO_ADDRESS, GIMO_ABI, gimoAmount);
              await swapAuto(walletInstance, "gimoToBtc", gimoAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] GIMO to BTC, ${randomGimo} GIMO`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap GIMO to BTC error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All BTC & GIMO swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapBtcGimo for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All BTC & GIMO swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapEthStog(totalSwaps) {
  log("Starting ETH & STOG swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing ETH & STOG swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
            const ethAmount = ethers.parseUnits(randomEth, 18);
            const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
            const currentEthBalance = await ethContract.balanceOf(walletInstance.address);
            if (currentEthBalance < ethAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, ETH_ADDRESS, ETH_ABI, ethAmount);
              await swapAuto(walletInstance, "ethToStog", ethAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] ETH to STOG, ${randomEth} ETH`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap ETH to STOG error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomStog = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
            const stogAmount = ethers.parseUnits(randomStog, 18);
            const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
            const currentStogBalance = await stogContract.balanceOf(walletInstance.address);
            if (currentStogBalance < stogAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient STOG balance: ${ethers.formatUnits(currentStogBalance, 18)} STOG`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, STOG_ADDRESS, STOG_ABI, stogAmount);
              await swapAuto(walletInstance, "stogToEth", stogAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] STOG to ETH, ${randomStog} STOG`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap STOG to ETH error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All ETH & STOG swaps completed for wallet: ${walletInstance.address.substring(0, 0)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapEthStog for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All ETH & STOG swaps completed for ALL accounts", "success");
  return true;
}

async function autoSwapBtcStog(totalSwaps) {
  log("Starting BTC & STOG swaps for all accounts...", "system");
  for (const walletInstance of wallets) {
    log(`════════════════════════════════════════════════════════════`, "system");
    log(`Processing BTC & STOG swaps for wallet: ${walletInstance.address}`, "system");
    log(`════════════════════════════════════════════════════════════`, "system");
    try {
      for (let i = 1; i <= totalSwaps; i++) {
        const isForward = i % 2 === 1;
        if (isForward) {
          try {
            const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
            const btcAmount = ethers.parseUnits(randomBtc, 18);
            const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
            const currentBtcBalance = await btcContract.balanceOf(walletInstance.address);
            if (currentBtcBalance < btcAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, BTC_ADDRESS, BTC_ABI, btcAmount);
              await swapAuto(walletInstance, "btcToStog", btcAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] BTC to STOG, ${randomBtc} BTC`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap BTC to STOG error: ${error.message}`, "error");
            continue;
          }
        } else {
          try {
            const randomStog = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
            const stogAmount = ethers.parseUnits(randomStog, 18);
            const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
            const currentStogBalance = await stogContract.balanceOf(walletInstance.address);
            if (currentStogBalance < stogAmount) {
              log(`[${walletInstance.address.substring(0, 8)}...] Insufficient STOG balance: ${ethers.formatUnits(currentStogBalance, 18)} STOG`, "error");
              continue;
            }
            await addTransactionToQueue(async () => {
              await approveToken(walletInstance, STOG_ADDRESS, STOG_ABI, stogAmount);
              await swapAuto(walletInstance, "stogToBtc", stogAmount);
            }, `[${walletInstance.address.substring(0, 8)}...] STOG to BTC, ${randomStog} STOG`);
          } catch (error) {
            log(`[${walletInstance.address.substring(0, 8)}...] Swap STOG to BTC error: ${error.message}`, "error");
            continue;
          }
        }
        log(`[${walletInstance.address.substring(0, 8)}...] Swap ${i} completed`, "success");
        if (i < totalSwaps) {
          log(`[${walletInstance.address.substring(0, 8)}...] Waiting 5 seconds before next swap...`, "warning");
          await interruptibleDelay(5000);
        }
      }
      log(`All BTC & STOG swaps completed for wallet: ${walletInstance.address.substring(0, 8)}...`, "success");
    } catch (error) {
      log(`Error in autoSwapBtcStog for wallet ${walletInstance.address.substring(0, 8)}...: ${error.message}`, "error");
    }
    log("----------------------------------------------------------------", "system");
    await interruptibleDelay(5000);
  }
  log("All BTC & STOG swaps completed for ALL accounts", "success");
  return true;
}


// --- MODIFIKASI: autoSwapAll sekarang memanggil fungsi yang dimodifikasi ---
async function autoSwapAll(totalSwaps) {
  try {
    log("Starting Auto All Swaps for all accounts...", "system");
    
    // Setiap fungsi autoSwap sudah melakukan iterasi per akun di dalamnya
    const usdtEthSuccess = await autoSwapUsdtEth(totalSwaps);
    if (!usdtEthSuccess) {
      log("Auto All stopped during USDT & ETH swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const usdtBtcSuccess = await autoSwapUsdtBtc(totalSwaps);
    if (!usdtBtcSuccess) {
      log("Auto All stopped during USDT & BTC swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const btcEthSuccess = await autoSwapBtcEth(totalSwaps);
    if (!btcEthSuccess) {
      log("Auto All stopped during BTC & ETH swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const usdtGimoSuccess = await autoSwapUsdtGimo(totalSwaps);
    if (!usdtGimoSuccess) {
      log("Auto All stopped during USDT & GIMO swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const usdtStogSuccess = await autoSwapUsdtStog(totalSwaps);
    if (!usdtStogSuccess) {
      log("Auto All stopped during USDT & STOG swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const btcUsdtSuccess = await autoSwapBtcUsdt(totalSwaps);
    if (!btcUsdtSuccess) {
      log("Auto All stopped during BTC & USDT swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const ethUsdtSuccess = await autoSwapEthUsdt(totalSwaps);
    if (!ethUsdtSuccess) {
      log("Auto All stopped during ETH & USDT swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const ethBtcSuccess = await autoSwapEthBtc(totalSwaps);
    if (!ethBtcSuccess) {
      log("Auto All stopped during ETH & BTC swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const ethGimoSuccess = await autoSwapEthGimo(totalSwaps);
    if (!ethGimoSuccess) {
      log("Auto All stopped during ETH & GIMO swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const btcGimoSuccess = await autoSwapBtcGimo(totalSwaps);
    if (!btcGimoSuccess) {
      log("Auto All stopped during BTC & GIMO swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const ethStogSuccess = await autoSwapEthStog(totalSwaps);
    if (!ethStogSuccess) {
      log("Auto All stopped during ETH & STOG swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair for all accounts...", "warning");
    await interruptibleDelay(5000);

    const btcStogSuccess = await autoSwapBtcStog(totalSwaps);
    if (!btcStogSuccess) {
      log("Auto All stopped during BTC & STOG swaps", "system");
      return;
    }

    log("All Auto All swaps completed for ALL accounts", "success");
  } catch (error) {
    log(`Error in autoSwapAll: ${error.message}`, "error");
  }
}

// --- MODIFIKASI: addTransactionToQueue tidak lagi membutuhkan nextNonce global ---
async function addTransactionToQueue(transactionFunction, description) {
  const transactionId = ++transactionIdCounter;
  transactionQueue.push({ id: transactionId, description, status: "queued" });
  log(`Transaction [${transactionId}] added to queue: ${description}`, "system");

  const processTransaction = async () => {
    transactionQueue.find((tx) => tx.id === transactionId).status = "processing";
    log(`Transaction [${transactionId}] processing`, "system");
    try {
      // Nonce sekarang dikelola di dalam fungsi approve/swap via getNonceForWallet
      await transactionFunction(); 
      transactionQueue.find((tx) => tx.id === transactionId).status = "completed";
      log(`Transaction [${transactionId}] completed`, "success");
    } catch (error) {
      // Nonce error sudah ditangani di approve/swap, jadi di sini hanya logging
      transactionQueue.find((tx) => tx.id === transactionId).status = "error";
      log(`Transaction [${transactionId}] failed: ${error.message}`, "error");
    } finally {
      transactionQueue = transactionQueue.filter((tx) => tx.id !== transactionId);
    }
  };

  // Logika antrian tetap sama
  if (transactionQueue.length === 1) {
    await processTransaction();
  } else {
    await new Promise((resolve) => {
      const checkQueue = setInterval(() => {
        if (transactionQueue.find((tx) => tx.id === transactionId)?.status === "processing") {
          clearInterval(checkQueue);
          resolve();
        }
      }, 100);
    });
    await processTransaction();
  }
}

async function chooseGasFee() {
  return new Promise((resolve) => {
    provider.getFeeData().then((data) => {
      const gasPriceBN = data.gasPrice;
      const options = [
        `1. Normal: ${ethers.formatUnits(gasPriceBN, "gwei")} Gneuron`,
        `2. Low: ${ethers.formatUnits(gasPriceBN * 80n / 100n, "gwei")} Gneuron`,
        `3. High: ${ethers.formatUnits(gasPriceBN * 2n, "gwei")} Gneuron`,
      ];
      log("══════════════════════ Gas Fee Selection ══════════════════════", "system");
      options.forEach((opt) => log(opt, "cyan"));
      log("══════════════════════════════════════════════════════════════", "system");
      readline.question(chalk.cyan(centerText("Enter choice (1-3): ")), (choice) => {
        const index = parseInt(choice) - 1;
        if (index === 0) resolve(gasPriceBN);
        else if (index === 1) resolve(gasPriceBN * 80n / 100n);
        else if (index === 2) resolve(gasPriceBN * 2n);
        else resolve(gasPriceBN);
      });
    });
  });
}

async function startTransactionProcess(pair, totalSwaps) {
  selectedGasPrice = await chooseGasFee();
  log(`Selected gas fee: ${ethers.formatUnits(selectedGasPrice, "gwei")} Gneuron`, "system");
  log(`Starting ${pair} for ${totalSwaps} swaps...`, "system");
  if (pair === "USDT & ETH") {
    await autoSwapUsdtEth(totalSwaps);
  } else if (pair === "USDT & BTC") {
    await autoSwapUsdtBtc(totalSwaps);
  } else if (pair === "BTC & ETH") {
    await autoSwapBtcEth(totalSwaps);
  } else if (pair === "USDT & GIMO") {
    await autoSwapUsdtGimo(totalSwaps);
  } else if (pair === "USDT & STOG") {
    await autoSwapUsdtStog(totalSwaps);
  } else if (pair === "BTC & USDT") {
    await autoSwapBtcUsdt(totalSwaps);
  } else if (pair === "ETH & USDT") {
    await autoSwapEthUsdt(totalSwaps);
  } else if (pair === "ETH & BTC") {
    await autoSwapEthBtc(totalSwaps);
  } else if (pair === "ETH & GIMO") {
    await autoSwapEthGimo(totalSwaps);
  } else if (pair === "BTC & GIMO") {
    await autoSwapBtcGimo(totalSwaps);
  } else if (pair === "ETH & STOG") {
    await autoSwapEthStog(totalSwaps);
  } else if (pair === "BTC & STOG") {
    await autoSwapBtcStog(totalSwaps);
  } else if (pair === "Auto All") {
    await autoSwapAll(totalSwaps);
  } else {
    log(`Swap logic for pair ${pair} not implemented`, "error");
  }
}

function showMenu() {
  console.log(chalk.cyan(centerText("══════════════════════ 0G Auto Swap Bot ══════════════════════")));
  console.log(chalk.cyan(centerText("1.  Check Wallet Balance")));
  console.log(chalk.cyan(centerText("2.  Auto Swap USDT & ETH")));
  console.log(chalk.cyan(centerText("3.  Auto Swap USDT & BTC")));
  console.log(chalk.cyan(centerText("4.  Auto Swap BTC & ETH")));
  console.log(chalk.cyan(centerText("5.  Auto Swap USDT & GIMO")));
  console.log(chalk.cyan(centerText("6.  Auto Swap USDT & STOG")));
  console.log(chalk.cyan(centerText("7.  Auto Swap BTC & USDT")));
  console.log(chalk.cyan(centerText("8.  Auto Swap ETH & USDT")));
  console.log(chalk.cyan(centerText("9.  Auto Swap ETH & BTC")));
  console.log(chalk.cyan(centerText("10. Auto Swap ETH & GIMO")));
  console.log(chalk.cyan(centerText("11. Auto Swap BTC & GIMO")));
  console.log(chalk.cyan(centerText("12. Auto Swap ETH & STOG")));
  console.log(chalk.cyan(centerText("13. Auto Swap BTC & STOG")));
  console.log(chalk.cyan(centerText("14. Auto All (All Pairs)")));
  console.log(chalk.cyan(centerText("15. Exit")));
  console.log(chalk.cyan(centerText("══════════════════════════════════════════════════════════════")));
  readline.question(chalk.cyan(centerText("Select an option (1-15): ")), async (choice) => {
    switch (choice) {
      case "1":
        await updateWalletData();
        showMenu();
        break;
      case "2":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("USDT & ETH", totalSwaps);
          showMenu();
        });
        break;
      case "3":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("USDT & BTC", totalSwaps);
          showMenu();
        });
        break;
      case "4":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("BTC & ETH", totalSwaps);
          showMenu();
        });
        break;
      case "5":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("USDT & GIMO", totalSwaps);
          showMenu();
        });
        break;
      case "6":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("USDT & STOG", totalSwaps);
          showMenu();
        });
        break;
      case "7":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("BTC & USDT", totalSwaps);
          showMenu();
        });
        break;
      case "8":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("ETH & USDT", totalSwaps);
          showMenu();
        });
        break;
      case "9":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("ETH & BTC", totalSwaps);
          showMenu();
        });
        break;
      case "10":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("ETH & GIMO", totalSwaps);
          showMenu();
        });
        break;
      case "11":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("BTC & GIMO", totalSwaps);
          showMenu();
        });
        break;
      case "12":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("ETH & STOG", totalSwaps);
          showMenu();
        });
        break;
      case "13":
        readline.question(chalk.cyan(centerText("Enter number of swaps per account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("BTC & STOG", totalSwaps);
          showMenu();
        });
        break;
      case "14":
        readline.question(chalk.cyan(centerText("Enter number of swaps per pair for each account: ")), async (value) => {
          const totalSwaps = parseInt(value);
          if (isNaN(totalSwaps) || totalSwaps <= 0) {
            log("Invalid number of swaps. Enter a number > 0.", "error");
            showMenu();
            return;
          }
          await startTransactionProcess("Auto All", totalSwaps);
          showMenu();
        });
        break;
      case "15":
        log("Exiting 0G Auto Swap Bot...", "system");
        readline.close();
        break;
      default:
        log("Invalid option. Please select a number between 1 and 15.", "error");
        showMenu();
    }
  });
}

async function main() {
  showBanner();
  showMenu();
}

main().catch((error) => {
  log(`Error in main: ${error.message}`, "error");
  readline.close();
});
