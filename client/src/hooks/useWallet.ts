import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

interface WalletState {
  isConnected: boolean;
  address: string;
  chainId: number;
  walletType: string;
  isConnecting: boolean;
}

const initialState: WalletState = {
  isConnected: false,
  address: '',
  chainId: 0,
  walletType: '',
  isConnecting: false
};

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>(initialState);
  const { toast } = useToast();

  const connectWallet = useCallback(async () => {
    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      // Check if MetaMask is installed
      if (typeof (window as any).ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      const ethereum = (window as any).ethereum;

      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your MetaMask wallet.');
      }

      // Get current chain ID
      const chainId = await ethereum.request({
        method: 'eth_chainId',
      });

      const walletState: WalletState = {
        isConnected: true,
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        walletType: 'MetaMask',
        isConnecting: false
      };

      setWallet(walletState);

      toast({
        title: "Wallet Connected",
        description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
      });

      // Store in localStorage for persistence
      localStorage.setItem('walletState', JSON.stringify(walletState));

      return walletState;
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      
      setWallet(prev => ({ ...prev, isConnecting: false }));
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
      
      throw error;
    }
  }, [toast]);

  const disconnectWallet = useCallback(() => {
    setWallet(initialState);
    localStorage.removeItem('walletState');
    
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  }, [toast]);

  const switchChain = useCallback(async (targetChainId: number) => {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        throw new Error('MetaMask not available');
      }

      const ethereum = (window as any).ethereum;
      const chainIdHex = `0x${targetChainId.toString(16)}`;

      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });

      setWallet(prev => ({ ...prev, chainId: targetChainId }));
      
      toast({
        title: "Network Switched",
        description: `Switched to chain ${targetChainId}`,
      });
    } catch (error: any) {
      console.error('Chain switch failed:', error);
      
      toast({
        title: "Switch Failed",
        description: error.message || "Failed to switch network",
        variant: "destructive"
      });
      
      throw error;
    }
  }, [toast]);

  const signTransaction = useCallback(async (transactionData: any) => {
    try {
      if (!wallet.isConnected) {
        throw new Error('Wallet not connected');
      }

      if (typeof (window as any).ethereum === 'undefined') {
        throw new Error('MetaMask not available');
      }

      const ethereum = (window as any).ethereum;

      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionData],
      });

      toast({
        title: "Transaction Sent",
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      return txHash;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      
      toast({
        title: "Transaction Failed",
        description: error.message || "Transaction was rejected",
        variant: "destructive"
      });
      
      throw error;
    }
  }, [wallet.isConnected, toast]);

  // Auto-connect on page load if previously connected
  useEffect(() => {
    const savedWallet = localStorage.getItem('walletState');
    if (savedWallet) {
      try {
        const parsedWallet = JSON.parse(savedWallet);
        setWallet(parsedWallet);
      } catch (error) {
        console.error('Failed to restore wallet state:', error);
        localStorage.removeItem('walletState');
      }
    }
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (typeof (window as any).ethereum !== 'undefined') {
      const ethereum = (window as any).ethereum;

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setWallet(prev => ({ ...prev, address: accounts[0] }));
        }
      };

      const handleChainChanged = (chainId: string) => {
        setWallet(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));
      };

      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [disconnectWallet]);

  return {
    wallet,
    connectWallet,
    disconnectWallet,
    switchChain,
    signTransaction,
    isConnected: wallet.isConnected,
    address: wallet.address,
    chainId: wallet.chainId
  };
}