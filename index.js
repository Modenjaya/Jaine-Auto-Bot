const { ethers } = require("ethers");
const chalk = require("chalk");
const fs = require("fs");

// Hardcoded environment variables from provided .env
const RPC_URL = "https://evmrpc-testnet.0g.ai/";
const ROUTER_ADDRESS = "0xb95B5953FF8ee5D5d9818CdbEfE363ff2191318c";
const USDT_ADDRESS = "0x3eC8A8705bE1D5ca90066b37ba62c4183B024ebf";
const ETH_ADDRESS = "0x0fE9B43625fA7EdD663aDcEC0728DD635e4AbF7c";
const BTC_ADDRESS = "0x36f6414FF1df609214dDAbA71c84f18bcf00F67d";
const GIMO_ADDRESS = "0xba2aE6c8cddd628a087D7e43C1Ba9844c5Bf9638"; // Removed spaces
const STOG_ADDRESS = "0x14d2F76020c1ECb29BcD673B51d8026C6836a66A"; // Removed spaces
const NETWORK_NAME = "OG LABS GALILEO TESTNET";
const EXPLORER_URL = "https://chainscan-galileo.0g.ai/tx/";
const APPROVAL_GAS_LIMIT = 100000;
const SWAP_GAS_LIMIT = 150000;

// Read private key from pv.txt
let PRIVATE_KEY;
try {
  PRIVATE_KEY = fs.readFileSync("pv.txt", "utf8").trim();
  if (!PRIVATE_KEY || !PRIVATE_KEY.match(/^0x[0-9a-fA-F]{64}$/)) {
    console.error("Invalid or missing private key in pv.txt. Ensure it is a 64-character hexadecimal string starting with 0x.");
    process.exit(1);
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
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

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

let transactionQueue = [];
let transactionIdCounter = 0;
let nextNonce = null;
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
    "           ----   Jaine Auto Swap Bot - v1.0  ----          ",
    "                   LETS FUCK THIS Testnet                   ",
    "         CREATED BY KAZUHA - Powered by 0G Labs Testnet     ",
    "════════════════════════════════════════════════════════════",
  ];
  banner.forEach((line) => console.log(chalk.cyan(centerText(line))));
}

async function updateWalletData() {
  try {
    const walletAddress = wallet.address;
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

    log("═══════════════════════════════════════════════", "system");
    log(`Wallet Address: ${walletAddress}`, "system");
    log(`OG Balance: ${saldoAOGI}`, "success");
    log(`ETH Balance: ${saldoETH}`, "success");
    log(`USDT Balance: ${saldoUSDT}`, "success");
    log(`BTC Balance: ${saldoBTC}`, "success");
    log(`GIMO Balance: ${saldoGIMO}`, "success");
    log(`STOG Balance: ${saldoSTOG}`, "success");
    log(`Network: ${NETWORK_NAME}`, "system");
    log("═══════════════════════════════════════════════", "system");
  } catch (error) {
    log(`Failed to update wallet data: ${error.message}`, "error");
  }
}

async function approveToken(tokenAddress, tokenAbi, amount) {
  try {
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, wallet);
    const currentAllowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);
    if (currentAllowance >= amount) {
      log("Approval already sufficient", "system");
      return;
    }
    const feeData = await provider.getFeeData();
    const tx = await tokenContract.approve(ROUTER_ADDRESS, amount, {
      gasLimit: APPROVAL_GAS_LIMIT,
      gasPrice: selectedGasPrice || feeData.gasPrice,
    });
    log(`Approval transaction sent: ${EXPLORER_URL}${tx.hash}`, "system");
    const interval = setInterval(() => {
      process.stdout.write(`\r${centerText(`${spinner[i % spinner.length]} Waiting for approval...`, 80)}`);
      i++;
    }, 200);
    await tx.wait();
    clearInterval(interval);
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    log("Approval successful", "success");
  } catch (error) {
    log(`Approval failed: ${error.message}`, "error");
    throw error;
  }
}

async function swapAuto(direction, amountIn) {
  try {
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const swapContract = new ethers.Contract(ROUTER_ADDRESS, CONTRACT_ABI, wallet);
    let params;
    const deadline = Math.floor(Date.now() / 1000) + 120;
    if (direction === "usdtToEth") {
      log(`Starting swap USDT to ETH: ${ethers.formatUnits(amountIn, 18)} USDT`, "system");
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToUsdt") {
      log(`Starting swap ETH to USDT: ${ethers.formatUnits(amountIn, 18)} ETH`, "system");
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "usdtToBtc") {
      log(`Starting swap USDT to BTC: ${ethers.formatUnits(amountIn, 18)} USDT`, "system");
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToUsdt") {
      log(`Starting swap BTC to USDT: ${ethers.formatUnits(amountIn, 18)} BTC`, "system");
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToEth") {
      log(`Starting swap BTC to ETH: ${ethers.formatUnits(amountIn, 18)} BTC`, "system");
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToBtc") {
      log(`Starting swap ETH to BTC: ${ethers.formatUnits(amountIn, 18)} ETH`, "system");
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "usdtToGimo") {
      log(`Starting swap USDT to GIMO: ${ethers.formatUnits(amountIn, 18)} USDT`, "system");
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: GIMO_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "gimoToUsdt") {
      log(`Starting swap GIMO to USDT: ${ethers.formatUnits(amountIn, 18)} GIMO`, "system");
      params = {
        tokenIn: GIMO_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "usdtToStog") {
      log(`Starting swap USDT to STOG: ${ethers.formatUnits(amountIn, 18)} USDT`, "system");
      params = {
        tokenIn: USDT_ADDRESS,
        tokenOut: STOG_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "stogToUsdt") {
      log(`Starting swap STOG to USDT: ${ethers.formatUnits(amountIn, 18)} STOG`, "system");
      params = {
        tokenIn: STOG_ADDRESS,
        tokenOut: USDT_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToGimo") {
      log(`Starting swap ETH to GIMO: ${ethers.formatUnits(amountIn, 18)} ETH`, "system");
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: GIMO_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "gimoToEth") {
      log(`Starting swap GIMO to ETH: ${ethers.formatUnits(amountIn, 18)} GIMO`, "system");
      params = {
        tokenIn: GIMO_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToGimo") {
      log(`Starting swap BTC to GIMO: ${ethers.formatUnits(amountIn, 18)} BTC`, "system");
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: GIMO_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "gimoToBtc") {
      log(`Starting swap GIMO to BTC: ${ethers.formatUnits(amountIn, 18)} GIMO`, "system");
      params = {
        tokenIn: GIMO_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "ethToStog") {
      log(`Starting swap ETH to STOG: ${ethers.formatUnits(amountIn, 18)} ETH`, "system");
      params = {
        tokenIn: ETH_ADDRESS,
        tokenOut: STOG_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "stogToEth") {
      log(`Starting swap STOG to ETH: ${ethers.formatUnits(amountIn, 18)} STOG`, "system");
      params = {
        tokenIn: STOG_ADDRESS,
        tokenOut: ETH_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "btcToStog") {
      log(`Starting swap BTC to STOG: ${ethers.formatUnits(amountIn, 18)} BTC`, "system");
      params = {
        tokenIn: BTC_ADDRESS,
        tokenOut: STOG_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else if (direction === "stogToBtc") {
      log(`Starting swap STOG to BTC: ${ethers.formatUnits(amountIn, 18)} STOG`, "system");
      params = {
        tokenIn: STOG_ADDRESS,
        tokenOut: BTC_ADDRESS,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0n,
      };
    } else {
      throw new Error("Unknown swap direction");
    }
    const gasPriceToUse = selectedGasPrice || (await provider.getFeeData()).gasPrice;
    const tx = await swapContract.exactInputSingle(params, {
      gasLimit: SWAP_GAS_LIMIT,
      gasPrice: gasPriceToUse,
    });
    log(`Swap transaction sent: ${EXPLORER_URL}${tx.hash}`, "warning");
    const interval = setInterval(() => {
      process.stdout.write(`\r${centerText(`${spinner[i % spinner.length]} Waiting for transaction...`, 80)}`);
      i++;
    }, 200);
    const receipt = await tx.wait();
    clearInterval(interval);
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    log(`Swap transaction successful: ${EXPLORER_URL}${tx.hash}`, "success");
    const feeAOGI = ethers.formatEther(receipt.gasUsed * gasPriceToUse);
    log(`Transaction fee: ${feeAOGI} OG`, "success");
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes("nonce")) {
      nextNonce = await provider.getTransactionCount(wallet.address, "pending");
      log(`Nonce refreshed: ${nextNonce}`, "system");
    }
    log(`Swap ${direction} failed: ${error.message}`, "error");
    throw error;
  }
}

async function autoSwapUsdtEth(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
          const usdtAmount = ethers.parseUnits(randomUsdt, 18);
          const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
          const currentUsdtBalance = await usdtContract.balanceOf(wallet.address);
          if (currentUsdtBalance < usdtAmount) {
            log(`Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(USDT_ADDRESS, USDT_ABI, usdtAmount);
            await swapAuto("usdtToEth", usdtAmount);
          }, `USDT to ETH, ${randomUsdt} USDT`);
        } catch (error) {
          log(`Swap USDT to ETH error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
          const ethAmount = ethers.parseUnits(randomEth, 18);
          const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
          const currentEthBalance = await ethContract.balanceOf(wallet.address);
          if (currentEthBalance < ethAmount) {
            log(`Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(ETH_ADDRESS, ETH_ABI, ethAmount);
            await swapAuto("ethToUsdt", ethAmount);
          }, `ETH to USDT, ${randomEth} ETH`);
        } catch (error) {
          log(`Swap ETH to USDT error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All USDT & ETH swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapUsdtEth: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapUsdtBtc(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
          const usdtAmount = ethers.parseUnits(randomUsdt, 18);
          const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
          const currentUsdtBalance = await usdtContract.balanceOf(wallet.address);
          if (currentUsdtBalance < usdtAmount) {
            log(`Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(USDT_ADDRESS, USDT_ABI, usdtAmount);
            await swapAuto("usdtToBtc", usdtAmount);
          }, `USDT to BTC, ${randomUsdt} USDT`);
        } catch (error) {
          log(`Swap USDT to BTC error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
          const btcAmount = ethers.parseUnits(randomBtc, 18);
          const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
          const currentBtcBalance = await btcContract.balanceOf(wallet.address);
          if (currentBtcBalance < btcAmount) {
            log(`Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(BTC_ADDRESS, BTC_ABI, btcAmount);
            await swapAuto("btcToUsdt", btcAmount);
          }, `BTC to USDT, ${randomBtc} BTC`);
        } catch (error) {
          log(`Swap BTC to USDT error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All USDT & BTC swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapUsdtBtc: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapBtcEth(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomBtc = (Math.random() * (0.05 - 0.01) + 0.01).toFixed(6);
          const btcAmount = ethers.parseUnits(randomBtc, 18);
          const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
          const currentBtcBalance = await btcContract.balanceOf(wallet.address);
          if (currentBtcBalance < btcAmount) {
            log(`Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(BTC_ADDRESS, BTC_ABI, btcAmount);
            await swapAuto("btcToEth", btcAmount);
          }, `BTC to ETH, ${randomBtc} BTC`);
        } catch (error) {
          log(`Swap BTC to ETH error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
          const ethAmount = ethers.parseUnits(randomEth, 18);
          const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
          const currentEthBalance = await ethContract.balanceOf(wallet.address);
          if (currentEthBalance < ethAmount) {
            log(`Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(ETH_ADDRESS, ETH_ABI, ethAmount);
            await swapAuto("ethToBtc", ethAmount);
          }, `ETH to BTC, ${randomEth} ETH`);
        } catch (error) {
          log(`Swap ETH to BTC error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All BTC & ETH swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapBtcEth: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapUsdtGimo(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
          const usdtAmount = ethers.parseUnits(randomUsdt, 18);
          const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
          const currentUsdtBalance = await usdtContract.balanceOf(wallet.address);
          if (currentUsdtBalance < usdtAmount) {
            log(`Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(USDT_ADDRESS, USDT_ABI, usdtAmount);
            await swapAuto("usdtToGimo", usdtAmount);
          }, `USDT to GIMO, ${randomUsdt} USDT`);
        } catch (error) {
          log(`Swap USDT to GIMO error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomGimo = (Math.random() * (1000 - 100) + 100).toFixed(2);
          const gimoAmount = ethers.parseUnits(randomGimo, 18);
          const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
          const currentGimoBalance = await gimoContract.balanceOf(wallet.address);
          if (currentGimoBalance < gimoAmount) {
            log(`Insufficient GIMO balance: ${ethers.formatUnits(currentGimoBalance, 18)} GIMO`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(GIMO_ADDRESS, GIMO_ABI, gimoAmount);
            await swapAuto("gimoToUsdt", gimoAmount);
          }, `GIMO to USDT, ${randomGimo} GIMO`);
        } catch (error) {
          log(`Swap GIMO to USDT error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All USDT & GIMO swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapUsdtGimo: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapUsdtStog(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
          const usdtAmount = ethers.parseUnits(randomUsdt, 18);
          const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
          const currentUsdtBalance = await usdtContract.balanceOf(wallet.address);
          if (currentUsdtBalance < usdtAmount) {
            log(`Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(USDT_ADDRESS, USDT_ABI, usdtAmount);
            await swapAuto("usdtToStog", usdtAmount);
          }, `USDT to STOG, ${randomUsdt} USDT`);
        } catch (error) {
          log(`Swap USDT to STOG error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomStog = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
          const stogAmount = ethers.parseUnits(randomStog, 18);
          const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
          const currentStogBalance = await stogContract.balanceOf(wallet.address);
          if (currentStogBalance < stogAmount) {
            log(`Insufficient STOG balance: ${ethers.formatUnits(currentStogBalance, 18)} STOG`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(STOG_ADDRESS, STOG_ABI, stogAmount);
            await swapAuto("stogToUsdt", stogAmount);
          }, `STOG to USDT, ${randomStog} STOG`);
        } catch (error) {
          log(`Swap STOG to USDT error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All USDT & STOG swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapUsdtStog: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapBtcUsdt(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
          const btcAmount = ethers.parseUnits(randomBtc, 18);
          const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
          const currentBtcBalance = await btcContract.balanceOf(wallet.address);
          if (currentBtcBalance < btcAmount) {
            log(`Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(BTC_ADDRESS, BTC_ABI, btcAmount);
            await swapAuto("btcToUsdt", btcAmount);
          }, `BTC to USDT, ${randomBtc} BTC`);
        } catch (error) {
          log(`Swap BTC to USDT error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
          const usdtAmount = ethers.parseUnits(randomUsdt, 18);
          const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
          const currentUsdtBalance = await usdtContract.balanceOf(wallet.address);
          if (currentUsdtBalance < usdtAmount) {
            log(`Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(USDT_ADDRESS, USDT_ABI, usdtAmount);
            await swapAuto("usdtToBtc", usdtAmount);
          }, `USDT to BTC, ${randomUsdt} USDT`);
        } catch (error) {
          log(`Swap USDT to BTC error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All BTC & USDT swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapBtcUsdt: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapEthUsdt(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
          const ethAmount = ethers.parseUnits(randomEth, 18);
          const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
          const currentEthBalance = await ethContract.balanceOf(wallet.address);
          if (currentEthBalance < ethAmount) {
            log(`Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(ETH_ADDRESS, ETH_ABI, ethAmount);
            await swapAuto("ethToUsdt", ethAmount);
          }, `ETH to USDT, ${randomEth} ETH`);
        } catch (error) {
          log(`Swap ETH to USDT error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomUsdt = (Math.random() * (300 - 100) + 100).toFixed(2);
          const usdtAmount = ethers.parseUnits(randomUsdt, 18);
          const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
          const currentUsdtBalance = await usdtContract.balanceOf(wallet.address);
          if (currentUsdtBalance < usdtAmount) {
            log(`Insufficient USDT balance: ${ethers.formatUnits(currentUsdtBalance, 18)} USDT`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(USDT_ADDRESS, USDT_ABI, usdtAmount);
            await swapAuto("usdtToEth", usdtAmount);
          }, `USDT to ETH, ${randomUsdt} USDT`);
        } catch (error) {
          log(`Swap USDT to ETH error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All ETH & USDT swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapEthUsdt: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapEthBtc(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
          const ethAmount = ethers.parseUnits(randomEth, 18);
          const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
          const currentEthBalance = await ethContract.balanceOf(wallet.address);
          if (currentEthBalance < ethAmount) {
            log(`Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(ETH_ADDRESS, ETH_ABI, ethAmount);
            await swapAuto("ethToBtc", ethAmount);
          }, `ETH to BTC, ${randomEth} ETH`);
        } catch (error) {
          log(`Swap ETH to BTC error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomBtc = (Math.random() * (0.05 - 0.01) + 0.01).toFixed(6);
          const btcAmount = ethers.parseUnits(randomBtc, 18);
          const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
          const currentBtcBalance = await btcContract.balanceOf(wallet.address);
          if (currentBtcBalance < btcAmount) {
            log(`Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(BTC_ADDRESS, BTC_ABI, btcAmount);
            await swapAuto("btcToEth", btcAmount);
          }, `BTC to ETH, ${randomBtc} BTC`);
        } catch (error) {
          log(`Swap BTC to ETH error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All ETH & BTC swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapEthBtc: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapEthGimo(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
          const ethAmount = ethers.parseUnits(randomEth, 18);
          const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
          const currentEthBalance = await ethContract.balanceOf(wallet.address);
          if (currentEthBalance < ethAmount) {
            log(`Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(ETH_ADDRESS, ETH_ABI, ethAmount);
            await swapAuto("ethToGimo", ethAmount);
          }, `ETH to GIMO, ${randomEth} ETH`);
        } catch (error) {
          log(`Swap ETH to GIMO error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomGimo = (Math.random() * (1000 - 100) + 100).toFixed(2);
          const gimoAmount = ethers.parseUnits(randomGimo, 18);
          const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
          const currentGimoBalance = await gimoContract.balanceOf(wallet.address);
          if (currentGimoBalance < gimoAmount) {
            log(`Insufficient GIMO balance: ${ethers.formatUnits(currentGimoBalance, 18)} GIMO`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(GIMO_ADDRESS, GIMO_ABI, gimoAmount);
            await swapAuto("gimoToEth", gimoAmount);
          }, `GIMO to ETH, ${randomGimo} GIMO`);
        } catch (error) {
          log(`Swap GIMO to ETH error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All ETH & GIMO swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapEthGimo: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapBtcGimo(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
          const btcAmount = ethers.parseUnits(randomBtc, 18);
          const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
          const currentBtcBalance = await btcContract.balanceOf(wallet.address);
          if (currentBtcBalance < btcAmount) {
            log(`Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(BTC_ADDRESS, BTC_ABI, btcAmount);
            await swapAuto("btcToGimo", btcAmount);
          }, `BTC to GIMO, ${randomBtc} BTC`);
        } catch (error) {
          log(`Swap BTC to GIMO error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomGimo = (Math.random() * (1000 - 100) + 100).toFixed(2);
          const gimoAmount = ethers.parseUnits(randomGimo, 18);
          const gimoContract = new ethers.Contract(GIMO_ADDRESS, GIMO_ABI, provider);
          const currentGimoBalance = await gimoContract.balanceOf(wallet.address);
          if (currentGimoBalance < gimoAmount) {
            log(`Insufficient GIMO balance: ${ethers.formatUnits(currentGimoBalance, 18)} GIMO`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(GIMO_ADDRESS, GIMO_ABI, gimoAmount);
            await swapAuto("gimoToBtc", gimoAmount);
          }, `GIMO to BTC, ${randomGimo} GIMO`);
        } catch (error) {
          log(`Swap GIMO to BTC error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All BTC & GIMO swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapBtcGimo: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapEthStog(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomEth = (Math.random() * (0.3 - 0.1) + 0.1).toFixed(6);
          const ethAmount = ethers.parseUnits(randomEth, 18);
          const ethContract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
          const currentEthBalance = await ethContract.balanceOf(wallet.address);
          if (currentEthBalance < ethAmount) {
            log(`Insufficient ETH balance: ${ethers.formatUnits(currentEthBalance, 18)} ETH`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(ETH_ADDRESS, ETH_ABI, ethAmount);
            await swapAuto("ethToStog", ethAmount);
          }, `ETH to STOG, ${randomEth} ETH`);
        } catch (error) {
          log(`Swap ETH to STOG error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomStog = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
          const stogAmount = ethers.parseUnits(randomStog, 18);
          const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
          const currentStogBalance = await stogContract.balanceOf(wallet.address);
          if (currentStogBalance < stogAmount) {
            log(`Insufficient STOG balance: ${ethers.formatUnits(currentStogBalance, 18)} STOG`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(STOG_ADDRESS, STOG_ABI, stogAmount);
            await swapAuto("stogToEth", stogAmount);
          }, `STOG to ETH, ${randomStog} STOG`);
        } catch (error) {
          log(`Swap STOG to ETH error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All ETH & STOG swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapEthStog: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapBtcStog(totalSwaps) {
  try {
    for (let i = 1; i <= totalSwaps; i++) {
      const isForward = i % 2 === 1;
      if (isForward) {
        try {
          const randomBtc = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6);
          const btcAmount = ethers.parseUnits(randomBtc, 18);
          const btcContract = new ethers.Contract(BTC_ADDRESS, BTC_ABI, provider);
          const currentBtcBalance = await btcContract.balanceOf(wallet.address);
          if (currentBtcBalance < btcAmount) {
            log(`Insufficient BTC balance: ${ethers.formatUnits(currentBtcBalance, 18)} BTC`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(BTC_ADDRESS, BTC_ABI, btcAmount);
            await swapAuto("btcToStog", btcAmount);
          }, `BTC to STOG, ${randomBtc} BTC`);
        } catch (error) {
          log(`Swap BTC to STOG error: ${error.message}`, "error");
          continue;
        }
      } else {
        try {
          const randomStog = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
          const stogAmount = ethers.parseUnits(randomStog, 18);
          const stogContract = new ethers.Contract(STOG_ADDRESS, STOG_ABI, provider);
          const currentStogBalance = await stogContract.balanceOf(wallet.address);
          if (currentStogBalance < stogAmount) {
            log(`Insufficient STOG balance: ${ethers.formatUnits(currentStogBalance, 18)} STOG`, "error");
            continue;
          }
          await addTransactionToQueue(async () => {
            await approveToken(STOG_ADDRESS, STOG_ABI, stogAmount);
            await swapAuto("stogToBtc", stogAmount);
          }, `STOG to BTC, ${randomStog} STOG`);
        } catch (error) {
          log(`Swap STOG to BTC error: ${error.message}`, "error");
          continue;
        }
      }
      log(`Swap ${i} completed`, "success");
      if (i < totalSwaps) {
        log(`Waiting 5 seconds before next swap...`, "warning");
        await interruptibleDelay(5000);
      }
    }
    log("All BTC & STOG swaps completed", "success");
    return true;
  } catch (error) {
    log(`Error in autoSwapBtcStog: ${error.message}`, "error");
    return false;
  }
}

async function autoSwapAll(totalSwaps) {
  try {
    log("Starting Auto All Swaps...", "system");
    const usdtEthSuccess = await autoSwapUsdtEth(totalSwaps);
    if (!usdtEthSuccess) {
      log("Auto All stopped during USDT & ETH swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const usdtBtcSuccess = await autoSwapUsdtBtc(totalSwaps);
    if (!usdtBtcSuccess) {
      log("Auto All stopped during USDT & BTC swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const btcEthSuccess = await autoSwapBtcEth(totalSwaps);
    if (!btcEthSuccess) {
      log("Auto All stopped during BTC & ETH swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const usdtGimoSuccess = await autoSwapUsdtGimo(totalSwaps);
    if (!usdtGimoSuccess) {
      log("Auto All stopped during USDT & GIMO swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const usdtStogSuccess = await autoSwapUsdtStog(totalSwaps);
    if (!usdtStogSuccess) {
      log("Auto All stopped during USDT & STOG swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const btcUsdtSuccess = await autoSwapBtcUsdt(totalSwaps);
    if (!btcUsdtSuccess) {
      log("Auto All stopped during BTC & USDT swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const ethUsdtSuccess = await autoSwapEthUsdt(totalSwaps);
    if (!ethUsdtSuccess) {
      log("Auto All stopped during ETH & USDT swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const ethBtcSuccess = await autoSwapEthBtc(totalSwaps);
    if (!ethBtcSuccess) {
      log("Auto All stopped during ETH & BTC swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const ethGimoSuccess = await autoSwapEthGimo(totalSwaps);
    if (!ethGimoSuccess) {
      log("Auto All stopped during ETH & GIMO swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const btcGimoSuccess = await autoSwapBtcGimo(totalSwaps);
    if (!btcGimoSuccess) {
      log("Auto All stopped during BTC & GIMO swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const ethStogSuccess = await autoSwapEthStog(totalSwaps);
    if (!ethStogSuccess) {
      log("Auto All stopped during ETH & STOG swaps", "system");
      return;
    }
    log("Waiting 5 seconds before next pair...", "warning");
    await interruptibleDelay(5000);
    const btcStogSuccess = await autoSwapBtcStog(totalSwaps);
    if (!btcStogSuccess) {
      log("Auto All stopped during BTC & STOG swaps", "system");
      return;
    }
    log("All Auto All swaps completed", "success");
  } catch (error) {
    log(`Error in autoSwapAll: ${error.message}`, "error");
  }
}

async function addTransactionToQueue(transactionFunction, description) {
  const transactionId = ++transactionIdCounter;
  transactionQueue.push({ id: transactionId, description, status: "queued" });
  log(`Transaction [${transactionId}] added to queue: ${description}`, "system");

  const processTransaction = async () => {
    transactionQueue.find((tx) => tx.id === transactionId).status = "processing";
    log(`Transaction [${transactionId}] processing`, "system");
    try {
      if (nextNonce === null) {
        nextNonce = await provider.getTransactionCount(wallet.address, "pending");
      }
      await transactionFunction();
      nextNonce++;
      transactionQueue.find((tx) => tx.id === transactionId).status = "completed";
      log(`Transaction [${transactionId}] completed`, "success");
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes("nonce")) {
        nextNonce = await provider.getTransactionCount(wallet.address, "pending");
        log(`Nonce refreshed: ${nextNonce}`, "system");
      }
      transactionQueue.find((tx) => tx.id === transactionId).status = "error";
      log(`Transaction [${transactionId}] failed: ${error.message}`, "error");
    } finally {
      transactionQueue = transactionQueue.filter((tx) => tx.id !== transactionId);
    }
  };

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
  console.log(chalk.cyan(centerText("5. Auto Swap USDT & GIMO")));
  console.log(chalk.cyan(centerText("6. Auto Swap USDT & STOG")));
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps: ")), async (value) => {
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
        readline.question(chalk.cyan(centerText("Enter number of swaps per pair: ")), async (value) => {
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
