const fs = require('fs');
const path = require('path');
const { SuiClient } = require('@mysten/sui.js/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { fromHEX } = require('@mysten/sui.js/utils');
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');
const chalk = require('chalk');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ora = require('ora');
const Table = require('cli-table3');
const nacl = require('tweetnacl');
const pLimit = require('p-limit'); 
const { bech32 } = require('bech32');
// Assuming './banner' exists; otherwise, remove or replace this
const { displayBanner } = require('./banner');

const CONFIG = {
    threads: 20, // Number of concurrent threads
    maxRetries: 5,
    rpcUrl: 'https://sui-rpc.publicnode.com',
    privateKeyFile: 'priv.txt',
    proxyFile: 'proxies.txt',
    successFile: 'success.txt',
    failFile: 'fail.txt',
    packageId: '0x352919f09a96e8bca46cd2a9015c5651aed4aa3ca270f8c09c96ef670c8ede59',
    moduleName: 'claim',
    functionName: 'claim_stamp',
    sharedObjectId: '0x73ffe6d1ae3d7355f9613631ca8b4490b1f41fa3be6b57de4d6b86c40ff9f863',
    passportObjectId: '0x7c5f0a96801378b156aef58eebd3a5201c87ed0a078b62b4d2c1984cb8a6858e', // Example passport ID
};

function getTimestamp() {
    const now = new Date();
    return `[${now.toLocaleTimeString()} ${now.toLocaleDateString()}]`;
}

function getKeypairFromPrivateKey(privateKey) {
    try {
        privateKey = privateKey.trim();
        let seedBuffer;
        if (privateKey.startsWith('suiprivkey')) {
            const decoded = bech32.decode(privateKey, 1000);
            seedBuffer = Buffer.from(bech32.fromWords(decoded.words));
            if (seedBuffer.length === 33) seedBuffer = seedBuffer.slice(1);
        } else {
            const cleaned = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
            seedBuffer = Buffer.from(cleaned, 'hex');
        }
        if (seedBuffer.length !== 32) throw new Error(`Expected seed length 32, got ${seedBuffer.length}`);
        const seed = new Uint8Array(seedBuffer);
        const naclKeyPair = nacl.sign.keyPair.fromSeed(seed);
        return Ed25519Keypair.fromSecretKey(naclKeyPair.secretKey.slice(0, 32));
    } catch (error) {
        throw new Error(`Failed to create keypair: ${error.message}`);
    }
}

async function getCurrentIP(axiosInstance) {
    try {
        const response = await axiosInstance.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (error) {
        return `Unknown (Error: ${error.message})`;
    }
}

function createAxiosInstance(proxy = null) {
    const config = proxy ? { httpsAgent: new HttpsProxyAgent(proxy), proxy: false } : {};
    return axios.create(config);
}

function createSuiClient(proxy = null) {
    const clientConfig = { url: CONFIG.rpcUrl };
    if (proxy) clientConfig.agent = new HttpsProxyAgent(proxy);
    return new SuiClient(clientConfig);
}

async function claimStamp(suiClient, keypair) {
    try {
        const tx = new TransactionBlock();
        const sharedObjectId = CONFIG.sharedObjectId;
        const passportObjectId = CONFIG.passportObjectId; // This should ideally be dynamic per wallet
        const walletAddress = keypair.getPublicKey().toSuiAddress();

        // Hardcoded vector<u8> from the JSON (64 bytes)
        const vectorU8 = [
            216, 28, 11, 203, 171, 103, 209, 8, 199, 219, 233, 156, 237, 134, 132, 219,
            159, 53, 253, 244, 206, 104, 20, 43, 148, 255, 39, 189, 180, 238, 64, 78,
            84, 97, 62, 84, 222, 34, 47, 187, 74, 185, 141, 41, 249, 141, 78, 201,
            226, 32, 95, 182, 140, 182, 223, 119, 105, 60, 127, 225, 190, 120, 69, 3
        ];

        tx.moveCall({
            target: `${CONFIG.packageId}::${CONFIG.moduleName}::${CONFIG.functionName}`,
            arguments: [
                tx.object(sharedObjectId),
                tx.object(passportObjectId),
                tx.pure("Walrus Mainnet"),
                tx.pure(vectorU8, "vector<u8>"),
                tx.object("0x4a4317676aa05a8e673dad0b2cc2fbf855b7170b5259340e2b76121bccbe9363"),
                tx.object("0x0000000000000000000000000000000000000000000000000000000000000006")
            ]
        });

        const result = await suiClient.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx,
            options: { showEffects: true, showEvents: true }
        });
        return result;
    } catch (error) {
        throw new Error(`Failed to create or send transaction: ${error.message}`);
    }
}

function readFileLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
}

function saveResult(walletAddress, privateKey, success = true) {
    const filePath = success ? CONFIG.successFile : CONFIG.failFile;
    const data = `${walletAddress}:${privateKey}\n`;
    try {
        fs.appendFileSync(filePath, data);
    } catch (error) {
        console.error(`Failed to write file ${filePath}: ${error.message}`);
    }
}

async function processWallet(workerData) {
    const { index, privateKey, proxies, proxyIndex } = workerData;

    let keypair, walletAddress;
    try {
        keypair = getKeypairFromPrivateKey(privateKey);
        walletAddress = keypair.getPublicKey().toSuiAddress();
    } catch (error) {
        parentPort.postMessage({
            type: 'log',
            data: { index, message: `Failed to create keypair: ${error.message}`, color: 'red' }
        });
        return { success: false, error: error.message };
    }

    let currentProxyIndex = proxyIndex;
    let currentProxy = proxies && proxies.length > 0 ? proxies[currentProxyIndex] : null;

    function useNextProxy() {
        currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
        currentProxy = proxies[currentProxyIndex];
    }

    function buildClients() {
        const axiosInstance = createAxiosInstance(currentProxy);
        return { axiosInstance, suiClient: createSuiClient(currentProxy) };
    }

    let { axiosInstance, suiClient } = buildClients();
    {
        const ip = await getCurrentIP(axiosInstance);
        parentPort.postMessage({
            type: 'log',
            data: { index, message: `Starting with IP: ${ip}`, color: 'cyan' }
        });
    }

    let attempt = 1;
    while (attempt <= CONFIG.maxRetries) {
        parentPort.postMessage({
            type: 'log',
            data: { index, message: `Attempt ${attempt}/${CONFIG.maxRetries} to claim stamp`, color: 'yellow' }
        });

        try {
            const result = await claimStamp(suiClient, keypair);
            if (result && result.digest) {
                parentPort.postMessage({
                    type: 'log',
                    data: { index, message: `Claim stamp succeeded, digest: ${result.digest}`, color: 'green' }
                });
                parentPort.postMessage({
                    type: 'save',

                    data: { walletAddress, privateKey, success: true }
                });
                return { success: true };
            } else {
                const errorMsg = result.effects?.status?.error || 'Unknown error';
                parentPort.postMessage({
                    type: 'log',
                    data: { index, message: `Claim failed: ${errorMsg}`, color: 'red' }
                });
                if (proxies && proxies.length > 0) {
                    useNextProxy();
                    ({ axiosInstance, suiClient } = buildClients());
                }
                attempt++;
            }
        } catch (error) {
            if (error.message.includes('429')) {
                parentPort.postMessage({
                    type: 'log',
                    data: { index, message: `Received 429 error. Rotating proxy and retrying.`, color: 'red' }
                });
                if (proxies && proxies.length > 0) {
                    useNextProxy();
                    ({ axiosInstance, suiClient } = buildClients());
                }
                await new Promise(res => setTimeout(res, 2000));
            } else {
                parentPort.postMessage({
                    type: 'log',
                    data: { index, message: `Error: ${error.message}`, color: 'red' }
                });
                if (proxies && proxies.length > 0) {
                    useNextProxy();
                    ({ axiosInstance, suiClient } = buildClients());
                }
                attempt++;
            }
        }
    }

    parentPort.postMessage({
        type: 'log',
        data: { index, message: `All attempts failed for wallet ${walletAddress}`, color: 'red' }
    });
    parentPort.postMessage({
        type: 'save',
        data: { walletAddress, privateKey, success: false }
    });
    return { success: false };
}

if (!isMainThread) {
    (async () => {
        try {
            const result = await processWallet(workerData);
            parentPort.postMessage({ type: 'done', data: result });
        } catch (error) {
            parentPort.postMessage({ type: 'error', data: error.message });
        }
    })();
}

async function main() {
    displayBanner();
    if (!isMainThread) return;
    console.log(chalk.cyan(`Threads: ${CONFIG.threads}`));
    console.log(chalk.cyan(`Max retries: ${CONFIG.maxRetries}`));

    let privateKeys = [];
    let proxies = [];

    try {
        privateKeys = readFileLines(CONFIG.privateKeyFile);
        console.log(chalk.cyan(`Loaded ${privateKeys.length} wallets from ${CONFIG.privateKeyFile}`));
    } catch (error) {
        console.error(chalk.red(error.message));
        process.exit(1);
    }

    try {
        proxies = readFileLines(CONFIG.proxyFile);
        console.log(chalk.cyan(`Loaded ${proxies.length} proxies from ${CONFIG.proxyFile}`));
    } catch (error) {
        console.log(chalk.yellow(`Proxy file not found or unreadable. Running without proxy.`));
    }

    if (privateKeys.length === 0) {
        console.error(chalk.red(`No private keys found in ${CONFIG.privateKeyFile}`));
        process.exit(1);
    }

    for (const filePath of [CONFIG.successFile, CONFIG.failFile]) {
        if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
    }

    const tasks = privateKeys.map((privateKey, i) => ({
        index: i + 1,
        privateKey,
        proxies,
        proxyIndex: proxies.length > 0 ? i % proxies.length : 0
    }));

    const limit = pLimit(CONFIG.threads);
    const results = await Promise.all(tasks.map(task => limit(() => {
        return new Promise((resolve) => {
            const worker = new Worker(__filename, { workerData: task });
            worker.on('message', (message) => {
                const { type, data } = message;
                if (type === 'log') {
                    const timestamp = getTimestamp();
                    console.log(`${timestamp} ${chalk[data.color](`[Wallet ${data.index}] ${data.message}`)}`);
                } else if (type === 'save') {
                    saveResult(data.walletAddress, data.privateKey, data.success);
                } else if (type === 'done') {
                    resolve(data);
                } else if (type === 'error') {
                    resolve({ success: false, error: data });
                }
            });
            worker.on('error', (error) => resolve({ success: false, error: error.message }));
            worker.on('exit', (code) => {
                if (code !== 0) console.error(`Worker exited with code ${code}`);
            });
        });
    })));

    let successful = 0, failed = 0;
    results.forEach(r => r.success ? successful++ : failed++);
    console.log(chalk.cyan('\n=== Summary ==='));
    const table = new Table({
        head: [chalk.cyan('Total Wallets'), chalk.green('Success'), chalk.red('Fail'), chalk.yellow('Output Files')]
    });
    table.push([tasks.length, successful, failed, `${CONFIG.successFile}, ${CONFIG.failFile}`]);
    console.log(table.toString());
}

if (isMainThread) {
    main().catch(error => {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    });
}
