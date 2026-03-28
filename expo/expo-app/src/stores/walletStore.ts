// Wallet Store - Zustand
import { create } from 'zustand';
import { Wallet, Transaction } from '../types';
import * as walletsApi from '../api/wallets';
import * as transactionsApi from '../api/transactions';
import * as paynowApi from '../api/paynow';

interface WalletState {
  wallet: Wallet | null;
  transactions: Transaction[];
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Actions
  fetchWallet: (userId: string) => Promise<void>;
  fetchTransactions: (userId: string) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  reconcilePendingPayments: (userId: string) => Promise<{ credited: number; amount: number }>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  isLoading: true,
  isRefreshing: false,

  fetchWallet: async (userId) => {
    const wallet = await walletsApi.getWallet(userId);
    set({ wallet, isLoading: false });
  },

  fetchTransactions: async (userId) => {
    const transactions = await transactionsApi.getTransactions(userId);
    set({ transactions });
  },

  refresh: async (userId) => {
    set({ isRefreshing: true });
    
    // Reconcile pending payments first
    await get().reconcilePendingPayments(userId);
    
    // Then fetch fresh data
    const wallet = await walletsApi.getWallet(userId);
    const transactions = await transactionsApi.getTransactions(userId);
    
    set({ wallet, transactions, isRefreshing: false, isLoading: false });
  },

  reconcilePendingPayments: async (userId) => {
    try {
      const pendingTxns = await transactionsApi.getPendingTransactions(userId);
      if (pendingTxns.length === 0) return { credited: 0, amount: 0 };

      let creditedCount = 0;
      let totalAmount = 0;

      for (const txn of pendingTxns) {
        if (!txn.paynow_poll_url) continue;
        
        const status = await paynowApi.pollPayment(txn.paynow_poll_url);
        if (status.paid) {
          const result = await walletsApi.creditWallet(txn.id, userId);
          if (result.success) {
            creditedCount++;
            totalAmount += txn.amount;
          }
        }
      }

      return { credited: creditedCount, amount: totalAmount };
    } catch (e) {
      return { credited: 0, amount: 0 };
    }
  },
}));

