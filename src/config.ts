import dotenv from 'dotenv';

dotenv.config();

export const RPC_ENDPOINT = process.env.RPC_ENDPOINT || '';

export const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 60000);

export const SOL_THRESHOLD = Number(process.env.SOL_THRESHOLD || 0.01);

export const TOP_UP_AMOUNT = Number(process.env.TOP_UP_AMOUNT || 0.02);

export const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || '';

if (!MASTER_SECRET_KEY) {
  console.error('Error: MASTER_SECRET_KEY is required in .env file');
  process.exit(1);
}


console.log('Configuration loaded:');
console.log(`- RPC Endpoint: ${RPC_ENDPOINT}`);
console.log(`- Check Interval: ${CHECK_INTERVAL / 1000} seconds`);
console.log(`- SOL Threshold: ${SOL_THRESHOLD} SOL`);
console.log(`- Top-up Amount: ${TOP_UP_AMOUNT} SOL`);
