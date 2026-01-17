import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { EventEmitter } from 'events';

export class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const data = this.index + this.previousHash + this.timestamp + 
                 JSON.stringify(this.transactions) + this.nonce;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  mineBlock(difficulty) {
    const target = '0'.repeat(difficulty);
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    
    console.log(`Block mined: ${this.hash}`);
    return this.hash;
  }
}

export class Blockchain extends EventEmitter {
  constructor() {
    super();
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 4;
    this.miningReward = 100;
    this.genesisBlock = this.createGenesisBlock();
    this.chain.push(this.genesisBlock);
  }

  createGenesisBlock() {
    return new Block(0, Date.now(), [], '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions(miningRewardAddress) {
    const block = new Block(
      this.chain.length,
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    block.mineBlock(this.difficulty);
    
    console.log('Block successfully mined!');
    this.chain.push(block);
    
    // Emit block mined event
    this.emit('block_mined', block);

    // Reset pending transactions and add mining reward
    this.pendingTransactions = [
      new Transaction(null, miningRewardAddress, this.miningReward, 'mining_reward')
    ];
  }

  addTransaction(transaction) {
    if (!transaction.from || !transaction.to) {
      throw new Error('Transaction must include from and to address');
    }

    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }

    this.pendingTransactions.push(transaction);
  }

  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.from === address) {
          balance -= trans.amount;
        }

        if (trans.to === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  replaceChain(newChain) {
    if (newChain.length <= this.chain.length) {
      console.log('Received chain is not longer than the current chain.');
      return false;
    } else if (!this.isChainValid()) {
      console.log('The received chain is not valid.');
      return false;
    }

    console.log('Replacing the current chain with the new chain.');
    this.chain = newChain;
    return true;
  }

  async saveToFile(filename) {
    try {
      await fs.writeFile(filename, JSON.stringify(this.chain, null, 2));
      console.log(`Blockchain saved to ${filename}`);
    } catch (error) {
      console.error('Error saving blockchain:', error);
    }
  }

  async loadFromFile(filename) {
    try {
      const data = await fs.readFile(filename, 'utf8');
      // Remove BOM (Byte Order Mark) if present
      const cleanedData = data.replace(/^\uFEFF/, '');
      this.chain = JSON.parse(cleanedData);
      console.log(`Blockchain loaded from ${filename}`);
    } catch (error) {
      console.error('Error loading blockchain:', error);
      throw error;
    }
  }
}

export class Transaction {
  constructor(from, to, amount, action = 'transfer', data = {}) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.action = action;
    this.data = data;
    this.timestamp = Date.now();
    this.hash = this.calculateHash();
    this.signature = null;
  }

  calculateHash() {
    const data = this.from + this.to + this.amount + this.action + 
                 JSON.stringify(this.data) + this.timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  signTransaction(signingKey) {
    if (signingKey.getPublic('hex') !== this.from) {
      throw new Error('You cannot sign transactions for other wallets!');
    }

    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');
    this.signature = sig.toDER('hex');
  }

  isValid() {
    if (this.from === null) return true; // Mining reward transaction

    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }

    // For now, we'll skip signature verification in this basic implementation
    // In a production system, you'd verify the signature here
    return true;
  }
}
