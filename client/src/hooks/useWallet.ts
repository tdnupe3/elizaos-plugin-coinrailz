import React, { useState, useEffect, useCallback } from 'react';
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

  // Auto-detect existing wallet connection
  React.useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        if (typeof (window as any).ethereum !== 'undefined') {
          const ethereum = (window as any).ethereum;
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          
          if (accounts.length > 0) {
            const chainId = await ethereum.request({ method: 'eth_chainId' });
            
            let walletType = 'MetaMask';
            if (ethereum.isCoinbaseWallet) walletType = 'Coinbase';
            else if (ethereum.isTrust) walletType = 'TrustWallet';
            
            // Check for Phantom (Solana)
            if (typeof (window as any).solana?.isPhantom) {
              const phantom = (window as any).solana;
              if (phantom.isConnected) {
                setWallet({
                  isConnected: true,
                  address: phantom.publicKey.toString(),
                  chainId: 999999, // Solana chain ID
                  walletType: 'Phantom',
                  isConnecting: false
                });
                return;
              }
            }
            
            setWallet({
              isConnected: true,
              address: accounts[0],
              chainId: parseInt(chainId, 16),
              walletType,
              isConnecting: false
            });
          }
        }
      } catch (error) {
        console.log('No existing wallet connection found');
      }
    };

    checkExistingConnection();
  }, []);

  // MetaMask connection
  const connectMetaMask = async (): Promise<WalletState> => {
    if (typeof (window as any).ethereum === 'undefined') {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    const ethereum = (window as any).ethereum;
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

    if (accounts.length === 0) {
      throw new Error('No accounts found. Please connect your MetaMask wallet.');
    }

    const chainId = await ethereum.request({ method: 'eth_chainId' });

    return {
      isConnected: true,
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      walletType: 'MetaMask',
      isConnecting: false
    };
  };

  // WalletConnect integration (simulated for now)
  const connectWalletConnect = async (): Promise<WalletState> => {
    // Simulated connection - full WalletConnect requires SDK
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      isConnected: true,
      address: '0x' + Math.random().toString(16).substring(2, 42),
      chainId: 1,
      walletType: 'WalletConnect',
      isConnecting: false
    };
  };

  // Coinbase Wallet integration
  const connectCoinbaseWallet = async (): Promise<WalletState> => {
    if (typeof (window as any).ethereum?.isCoinbaseWallet !== 'undefined') {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const chainId = await ethereum.request({ method: 'eth_chainId' });

      return {
        isConnected: true,
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        walletType: 'Coinbase',
        isConnecting: false
      };
    } else {
      throw new Error('Coinbase Wallet is not installed. Please install Coinbase Wallet to continue.');
    }
  };

  // Trust Wallet integration
  const connectTrustWallet = async (): Promise<WalletState> => {
    if (typeof (window as any).ethereum?.isTrust !== 'undefined') {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const chainId = await ethereum.request({ method: 'eth_chainId' });

      return {
        isConnected: true,
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        walletType: 'TrustWallet',
        isConnecting: false
      };
    } else {
      throw new Error('Trust Wallet is not installed. Please install Trust Wallet to continue.');
    }
  };

  // Phantom Wallet integration (Solana)
  const connectPhantomWallet = async (): Promise<WalletState> => {
    if (typeof (window as any).solana?.isPhantom) {
      const phantom = (window as any).solana;
      
      const response = await phantom.connect();
      
      return {
        isConnected: true,
        address: response.publicKey.toString(),
        chainId: 999999, // Use special ID for Solana
        walletType: 'Phantom',
        isConnecting: false
      };
    } else {
      throw new Error('Phantom Wallet is not installed. Please install Phantom Wallet to continue.');
    }
  };

  const connectWallet = useCallback(async (walletType: string = 'MetaMask') => {
    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      let walletState: WalletState;

      if (walletType === 'MetaMask') {
        walletState = await connectMetaMask();
      } else if (walletType === 'WalletConnect') {
        walletState = await connectWalletConnect();
      } else if (walletType === 'Coinbase') {
        walletState = await connectCoinbaseWallet();
      } else if (walletType === 'TrustWallet') {
        walletState = await connectTrustWallet();
      } else if (walletType === 'Phantom') {
        walletState = await connectPhantomWallet();
      } else {
        throw new Error(`Wallet type ${walletType} is not supported yet`);
      }

      setWallet(walletState);

      toast({
        title: "Wallet Connected",
        description: `Connected to ${walletType} successfully`,
      });

    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      setWallet(prev => ({ ...prev, isConnecting: false }));
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
    }
  }, [toast]);

  const disconnectWallet = useCallback(() => {
    setWallet(initialState);
    
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  }, [toast]);

  const switchChain = useCallback(async (targetChainId: number) => {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        throw new Error('No wallet available');
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
    }
  }, [toast]);

  const signTransaction = useCallback(async (transactionData: any) => {
    if (!wallet.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const ethereum = (window as any).ethereum;
      
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionData],
      });

      toast({
        title: "Transaction Signed",
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      return txHash;
    } catch (error: any) {
      console.error('Transaction signing failed:', error);
      
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to sign transaction",
        variant: "destructive"
      });
      
      throw error;
    }
  }, [wallet.isConnected, toast]);

  return {
    wallet,
    connectWallet,
    disconnectWallet,
    switchChain,
    signTransaction
  };
}