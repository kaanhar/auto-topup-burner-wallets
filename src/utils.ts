import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

export function loadKeypair(secret: string) {
  try {
    const cleanSecret = secret.trim();
    console.log('Private key length:', cleanSecret.length);
    
    const decoded = bs58.decode(cleanSecret);
    console.log('Decoded key length:', decoded.length);
    
    const keypair = Keypair.fromSecretKey(decoded);
    console.log('Public key:', keypair.publicKey.toBase58());
    
    return keypair;
  } catch (error) {
    console.error('Error loading keypair:', error);
    throw error;
  }
}

export async function getSolBalance(
  conn: Connection,
  pubkey: PublicKey
): Promise<number> {
  const balance = await conn.getBalance(pubkey);
  return balance / LAMPORTS_PER_SOL;
}
