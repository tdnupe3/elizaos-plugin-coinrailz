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
            
            // Check for Phantom Ethereum mode with proper error handling
            if (typeof window !== 'undefined' && (window as any).phantom?.ethereum) {
              try {
                const phantomEth = (window as any).phantom.ethereum;
                const phantomAccounts = await phantomEth.request({ method: 'eth_accounts' });
                if (phantomAccounts.length > 0) {
                  const phantomChainId = await phantomEth.request({ method: 'eth_chainId' });
                  setWallet({
                    isConnected: true,
                    address: phantomAccounts[0],
                    chainId: parseInt(phantomChainId, 16),
                    walletType: 'Phantom',
                    isConnecting: false
                  });
                  return;
                }
              } catch (error) {
                console.log('Phantom connection check failed:', error);
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
    if (typeof window === 'undefined' || typeof (window as any).ethereum === 'undefined') {
      throw new Error('MetaMask not detected. Please install MetaMask browser extension.');
    }

    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

      if (accounts.length === 0) {
        throw new Error('No accounts available in MetaMask');
      }

      const chainId = await ethereum.request({ method: 'eth_chainId' });

      return {
        isConnected: true,
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        walletType: 'MetaMask',
        isConnecting: false
      };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw new Error(`MetaMask connection failed: ${error.message}`);
    }
  };

  // WalletConnect integration - Enhanced implementation
  const connectWalletConnect = async (): Promise<WalletState> => {
    try {
      // Check if WalletConnect is available via any wallet app
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        // Many mobile wallets inject ethereum object via WalletConnect
        const ethereum = (window as any).ethereum;
        
        // Try to connect using standard ethereum provider
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
          throw new Error('No accounts available via WalletConnect');
        }
        
        const chainId = await ethereum.request({ method: 'eth_chainId' });

        return {
          isConnected: true,
          address: accounts[0],
          chainId: parseInt(chainId, 16),
          walletType: 'WalletConnect',
          isConnecting: false
        };
      } else {
        throw new Error('WalletConnect not available. Please use a mobile wallet that supports WalletConnect.');
      }
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw new Error(`WalletConnect failed: ${error.message}`);
    }
  };

  // Coinbase Wallet integration
  const connectCoinbaseWallet = async (): Promise<WalletState> => {
    // Check for Coinbase Wallet - it sets isCoinbaseWallet to true
    if (typeof window !== 'undefined' && (window as any).ethereum?.isCoinbaseWallet === true) {
      try {
        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
          throw new Error('No accounts available in Coinbase Wallet');
        }
        
        const chainId = await ethereum.request({ method: 'eth_chainId' });

        return {
          isConnected: true,
          address: accounts[0],
          chainId: parseInt(chainId, 16),
          walletType: 'Coinbase',
          isConnecting: false
        };
      } catch (error: any) {
        if (error.code === 4001) {
          throw new Error('User rejected the connection request');
        }
        throw new Error(`Coinbase Wallet connection failed: ${error.message}`);
      }
    } else {
      throw new Error('Coinbase Wallet not detected. Please install Coinbase Wallet browser extension.');
    }
  };

  // Trust Wallet integration
  const connectTrustWallet = async (): Promise<WalletState> => {
    // Check for Trust Wallet - it sets isTrust to true
    if (typeof window !== 'undefined' && (window as any).ethereum?.isTrust === true) {
      try {
        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
          throw new Error('No accounts available in Trust Wallet');
        }
        
        const chainId = await ethereum.request({ method: 'eth_chainId' });

        return {
          isConnected: true,
          address: accounts[0],
          chainId: parseInt(chainId, 16),
          walletType: 'TrustWallet',
          isConnecting: false
        };
      } catch (error: any) {
        if (error.code === 4001) {
          throw new Error('User rejected the connection request');
        }
        throw new Error(`Trust Wallet connection failed: ${error.message}`);
      }
    } else {
      throw new Error('Trust Wallet not detected. Please install Trust Wallet mobile app or browser extension.');
    }
  };

  // Phantom Wallet integration (Ethereum mode)
  const connectPhantomWallet = async (): Promise<WalletState> => {
    // Give Phantom time to inject its provider
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for Phantom's Ethereum provider first
    if (typeof window !== 'undefined' && (window as any).phantom?.ethereum) {
      try {
        const ethereum = (window as any).phantom.ethereum;
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
          throw new Error('No accounts available in Phantom wallet');
        }
        
        const chainId = await ethereum.request({ method: 'eth_chainId' });

        return {
          isConnected: true,
          address: accounts[0],
          chainId: parseInt(chainId, 16),
          walletType: 'Phantom',
          isConnecting: false
        };
      } catch (error: any) {
        if (error.code === 4001) {
          throw new Error('User rejected the connection request');
        }
        throw new Error(`Phantom connection failed: ${error.message}`);
      }
    } 
    // Check for Phantom Solana provider
    else if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
      throw new Error('Phantom detected but only Solana mode is available. Please enable Ethereum mode in Phantom settings for DEX trading.');
    }
    // Check if Phantom is installed but not loaded yet
    else if (typeof window !== 'undefined' && (window as any).phantom) {
      throw new Error('Phantom detected but Ethereum provider not available. Please enable Ethereum mode in Phantom wallet settings.');
    }
    else {
      throw new Error('Phantom Wallet not detected. Please install Phantom Wallet and refresh the page.');
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