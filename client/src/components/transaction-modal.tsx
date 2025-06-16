import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "@/lib/icons";
import type { Transaction } from "@shared/schema";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export function TransactionModal({ isOpen, onClose, transaction }: TransactionModalProps) {
  if (!transaction) return null;

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <DialogTitle className="text-xl font-semibold text-neutral-800">
            Payment Sent!
          </DialogTitle>
          <DialogDescription>
            Your payment has been successfully sent.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-neutral-50 rounded-lg p-4 my-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-600">Amount</span>
              <span className="font-semibold text-neutral-800">
                {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-600">To</span>
              <span className="font-semibold text-neutral-800">
                {transaction.toEmail}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-600">Transaction ID</span>
              <span className="font-mono text-sm text-neutral-500">
                #MR{transaction.id?.toString().padStart(6, "0")}
              </span>
            </div>
          </div>
        </div>

        <Button 
          onClick={onClose}
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
