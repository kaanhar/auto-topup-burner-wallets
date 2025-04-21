import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, `monitor-${new Date().toISOString().split('T')[0]}.log`);
const TOPUP_LOG_FILE = path.join(LOG_DIR, 'topups.json');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize topup log file if it doesn't exist
if (!fs.existsSync(TOPUP_LOG_FILE)) {
  fs.writeFileSync(TOPUP_LOG_FILE, JSON.stringify([], null, 2));
}

function formatMessage(message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${message}\n`;
}

export function log(message: string) {
  const formattedMessage = formatMessage(message);
  console.log(message); 
  fs.appendFileSync(LOG_FILE, formattedMessage);
}

export function error(message: string, error?: any) {
  const errorMessage = error ? `${message}: ${error.message || error}` : message;
  const formattedMessage = formatMessage(`ERROR: ${errorMessage}`);
  console.error(message, error); 
  fs.appendFileSync(LOG_FILE, formattedMessage);
}

export function logTopup(wallet: string, amount: number, tx: string) {
  const topupLog = {
    timestamp: new Date().toISOString(),
    wallet,
    amount,
    transaction: tx
  };

  const existingLogs = JSON.parse(fs.readFileSync(TOPUP_LOG_FILE, 'utf-8'));
  
  existingLogs.push(topupLog);
  
  fs.writeFileSync(TOPUP_LOG_FILE, JSON.stringify(existingLogs, null, 2));
  
  log(`💸 Topup recorded: ${wallet} - ${amount} SOL - TX: ${tx}`);
} 