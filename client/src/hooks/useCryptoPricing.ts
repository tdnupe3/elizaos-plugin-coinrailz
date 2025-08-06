import { useQuery } from '@tanstack/react-query';

interface CryptoPrice {
  USD: number;
  change24h: number;
  lastUpdated: string;
}

interface CryptoPrices {
  [key: string]: CryptoPrice;
}

export const useCryptoPricing = () => {
  return useQuery<{
    success: boolean;
    rates: CryptoPrices;
    lastUpdated: string;
    source: string;
  }>({
    queryKey: ['/api/crypto/rates'],
    staleTime: 60000, // 1 minute stale time
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useXRPPrice = () => {
  return useQuery<{
    success: boolean;
    rate: {
      XRP_USD: number;
      lastUpdated: string;
      change24h: string;
      source?: string;
    };
  }>({
    queryKey: ['/api/xrp/rate'],
    staleTime: 60000, // 1 minute stale time
    refetchInterval: 60000, // Refetch every minute
  });
};