import { useState } from "react";
import { AlertTriangle, X, Shield, Eye, EyeOff } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SafetyWarningProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  operationType: 'crypto_transfer' | 'p2p_transfer' | 'onramp' | 'offramp' | 'dex_swap';
  recipientAddress?: string;
  amount?: string;
  currency?: string;
}

const getWarningContent = (operationType: string) => {
  const commonWarnings = [
    "Ensure you are entering the correct wallet address - transactions cannot be reversed",
    "Double-check all recipient information before proceeding",
    "Never share your private keys or seed phrases with anyone",
    "Be aware of phishing attempts and only use official Coin Railz interfaces"
  ];

  const operationSpecific = {
    crypto_transfer: [
      "Cryptocurrency transfers to external wallets are irreversible",
      "Verify the blockchain network matches your recipient's wallet",
      "Test with a small amount first if sending to a new address",
      "Some networks may have additional fees beyond what's displayed"
    ],
    p2p_transfer: [
      "Verify recipient identity through multiple channels if possible",
      "Be cautious of requests to send money to unfamiliar contacts",
      "Ensure the platform selection matches recipient's account"
    ],
    onramp: [
      "Verify your bank account details are correct",
      "Crypto purchases may take time to reflect in your wallet",
      "Market prices may change between order placement and execution"
    ],
    offramp: [
      "Ensure your linked bank account is active and verified",
      "Processing times may vary based on your financial institution",
      "Tax implications may apply to crypto sales"
    ],
    dex_swap: [
      "DEX swaps are subject to slippage and may execute at different prices",
      "Gas fees are required and may fluctuate based on network congestion",
      "Ensure you understand the tokens you are swapping"
    ]
  };

  return {
    common: commonWarnings,
    specific: operationSpecific[operationType as keyof typeof operationSpecific] || []
  };
};

export default function SafetyWarning({
  isOpen,
  onAccept,
  onDecline,
  operationType,
  recipientAddress,
  amount,
  currency
}: SafetyWarningProps) {
  const [addressVisible, setAddressVisible] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const [acknowledgedResponsibility, setAcknowledgedResponsibility] = useState(false);

  const warnings = getWarningContent(operationType);
  const canProceed = acknowledgedRisks && acknowledgedResponsibility;

  const handleAccept = () => {
    if (canProceed) {
      onAccept();
    }
  };

  const operationLabels = {
    crypto_transfer: 'Cryptocurrency Transfer',
    p2p_transfer: 'P2P Money Transfer',
    onramp: 'Buy Cryptocurrency',
    offramp: 'Sell Cryptocurrency',
    dex_swap: 'Token Swap'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDecline}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
            <span>Security Warning - {operationLabels[operationType]}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Please read and acknowledge the following important safety information before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Summary */}
          {(recipientAddress || amount) && (
            <Alert className="border-amber-200 bg-amber-50">
              <Shield className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">Transaction Summary:</div>
                  {amount && currency && (
                    <div>Amount: <span className="font-mono">{amount} {currency}</span></div>
                  )}
                  {recipientAddress && (
                    <div className="flex items-center space-x-2">
                      <span>Recipient:</span>
                      <span className="font-mono text-sm">
                        {addressVisible ? recipientAddress : `${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-8)}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddressVisible(!addressVisible)}
                        className="h-6 w-6 p-0"
                      >
                        {addressVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* General Security Warnings */}
          <div className="space-y-3">
            <h4 className="font-semibold text-red-600">Security Best Practices:</h4>
            <ul className="space-y-2 text-sm">
              {warnings.common.map((warning, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Operation-Specific Warnings */}
          {warnings.specific.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-orange-600">Additional Considerations:</h4>
              <ul className="space-y-2 text-sm">
                {warnings.specific.map((warning, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-2">
                <div className="font-semibold">IMPORTANT DISCLAIMER:</div>
                <div className="text-sm">
                  Coin Railz is not responsible for funds lost due to:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Incorrect wallet addresses or recipient information</li>
                    <li>Sending funds to malicious parties or scammers</li>
                    <li>Network fees or failed transactions due to insufficient gas</li>
                    <li>Market volatility or price changes during transaction processing</li>
                    <li>User error in transaction details or security practices</li>
                  </ul>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Acknowledgment Checkboxes */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="risks"
                checked={acknowledgedRisks}
                onCheckedChange={(checked) => setAcknowledgedRisks(checked as boolean)}
              />
              <label htmlFor="risks" className="text-sm leading-5 cursor-pointer">
                I understand the risks involved in this transaction and have verified all details are correct
              </label>
            </div>
            
            <div className="flex items-start space-x-3">
              <Checkbox
                id="responsibility"
                checked={acknowledgedResponsibility}
                onCheckedChange={(checked) => setAcknowledgedResponsibility(checked as boolean)}
              />
              <label htmlFor="responsibility" className="text-sm leading-5 cursor-pointer">
                I acknowledge that Coin Railz is not responsible for losses due to incorrect addresses, 
                user error, or sending funds to malicious parties
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="space-x-2 pt-6">
          <Button
            variant="outline"
            onClick={onDecline}
            className="w-24"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!canProceed}
            className={`w-32 ${canProceed 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}