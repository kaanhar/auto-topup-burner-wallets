import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
  } from '@solana/web3.js';
  import { RPC_ENDPOINT, MASTER_SECRET_KEY, SOL_THRESHOLD, TOP_UP_AMOUNT, CHECK_INTERVAL } from './config';
  import { loadKeypair, getSolBalance } from './utils';
  import { log, error, logTopup } from './logger';
  import fs from 'fs';
  import path from 'path';
  
  interface Wallet {
    address: string;
    privateKey: string;
    balance: number;
    name: string;
  }
  
  const connection = new Connection(RPC_ENDPOINT, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
  const master = loadKeypair(MASTER_SECRET_KEY);
  const walletsPath = path.join(__dirname, 'wallets.json');
  const logsPath = path.join(__dirname, 'logs');
  
  // Track wallets being processed to prevent duplicate top-ups
  const processingWallets = new Set<string>();
  
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
  }
  
  function readWallets(): Wallet[] {
    try {
      return JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
    } catch (error) {
      console.error('Error reading wallets:', error);
      return [];
    }
  }
  
  function writeWallets(wallets: Wallet[]) {
    try {
      const tempPath = `${walletsPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(wallets, null, 2));
      fs.renameSync(tempPath, walletsPath);
    } catch (error) {
      console.error('Error writing wallets:', error);
    }
  }
  

  async function updateWalletBalances(wallets: Wallet[]) {
    for (const wallet of wallets) {
      try {
        const balance = await connection.getBalance(new PublicKey(wallet.address));
        wallet.balance = balance / 1e9;
      } catch (err: any) {
        error(`Error getting balance for ${wallet.address}:`, err);
        if (err?.message?.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    return wallets;
  }
  
  async function checkMasterBalance(requiredAmount: number): Promise<boolean> {
    try {
      const balance = await connection.getBalance(master.publicKey);
      const solBalance = balance / 1e9;
      
      if (solBalance < requiredAmount) {
        error(`Master wallet balance too low: ${solBalance} SOL (needed: ${requiredAmount} SOL)`);
        return false;
      }
      return true;
    } catch (err) {
      error('Error checking master balance:', err);
      return false;
    }
  }
  
  async function topUpWallet(dest: PublicKey) {
    const destStr = dest.toString();
    
    if (processingWallets.has(destStr)) {
      log(`Skipping duplicate top-up for ${destStr}`);
      return false;
    }
  
    try {
      processingWallets.add(destStr);
  
      if (!await checkMasterBalance(TOP_UP_AMOUNT + 0.01)) {
        return false;
      }
  
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: master.publicKey,
          toPubkey: dest,
          lamports: TOP_UP_AMOUNT * 1e9,
        })
      );
  
      const signature = await sendAndConfirmTransaction(connection, tx, [master], {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      });
  
      log(`✅ Topped up ${destStr} with ${TOP_UP_AMOUNT} SOL — TX: ${signature}`);
      logTopup(destStr, TOP_UP_AMOUNT, signature);
      return true;
    } catch (err) {
      error(`Failed to top up ${destStr}`, err);
      return false;
    } finally {
      processingWallets.delete(destStr);
    }
  }
  
  async function monitorWallets() {
    const wallets = readWallets();
    const updatedWallets = await updateWalletBalances(wallets);
    writeWallets(updatedWallets);
  
    for (const wallet of updatedWallets) {
      if (wallet.balance < SOL_THRESHOLD) {
        log(`Low balance detected for ${wallet.name} (${wallet.address}): ${wallet.balance} SOL`);
        await topUpWallet(new PublicKey(wallet.address));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  async function monitorLoop() {
    log('🚀 Starting wallet monitor...');
    
    const masterBalance = await connection.getBalance(master.publicKey);
    log(`💰 Master wallet (${master.publicKey.toString()}) balance: ${masterBalance / 1e9} SOL`);
    
    const setupSubscriptions = async () => {
      const wallets = readWallets();
      for (const wallet of wallets) {
        const pubkey = new PublicKey(wallet.address);
        
        try {
          const initialBalance = await getSolBalance(connection, pubkey);
          log(`🟢 ${wallet.name} (${wallet.address}) initial balance: ${initialBalance} SOL`);
          
          connection.onAccountChange(
            pubkey,
            async (accountInfo) => {
              const balance = accountInfo.lamports / 1e9;
              log(`📊 ${wallet.name} (${wallet.address}) balance update: ${balance} SOL`);
              
              if (balance < SOL_THRESHOLD) {
                log(`🔴 ${wallet.name} (${wallet.address}) is low (${balance} SOL) → topping up...`);
                await topUpWallet(pubkey);
              }
            },
            'confirmed'
          );
        } catch (err) {
          error(`Failed to monitor ${wallet.name} (${wallet.address})`, err);
        }
      }
    };
  
    await setupSubscriptions();
  
    while (true) {
      try {
        await monitorWallets();
      } catch (err) {
        error('Error in monitoring loop:', err);
      }
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
  }
  
  process.on('SIGINT', () => {
    log('👋 Shutting down monitor...');
    process.exit(0);
  });
  
  log('Starting wallet monitor...');
  monitorLoop().catch(err => error('Monitor loop error:', err));
  