import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, ArrowRight, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export function CheckoutSuccessPage() {
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get payment_intent from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const paymentIntentId = urlParams.get('payment_intent');
        const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');

        if (!paymentIntentId) {
          setPaymentStatus('error');
          return;
        }

        // Verify payment completion with our backend
        const response = await apiRequest('POST', '/api/campaigns/verify-payment', {
          payment_intent_id: paymentIntentId,
          client_secret: paymentIntentClientSecret
        });

        setPaymentDetails(response);
        setPaymentStatus('success');

        toast({
          title: "Payment Successful!",
          description: "Your partnership activation is now in progress.",
        });

      } catch (error: any) {
        console.error('Payment verification failed:', error);
        setPaymentStatus('error');
        toast({
          title: "Payment Verification Failed",
          description: "Please contact support if you were charged.",
          variant: "destructive"
        });
      }
    };

    verifyPayment();
  }, [toast]);

  if (paymentStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="font-semibold mb-2">Verifying Payment...</h3>
            <p className="text-muted-foreground text-sm">Please wait while we confirm your payment</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="font-semibold mb-2">Payment Verification Failed</h3>
            <p className="text-muted-foreground mb-4">
              We couldn't verify your payment. If you were charged, please contact support.
            </p>
            <Button asChild variant="outline">
              <a href="/dashboard">Return to Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">Payment Successful!</CardTitle>
            <p className="text-green-600">
              Your ${paymentDetails?.amount?.toLocaleString()} campaign partnership is now active
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Payment Summary */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-3">Payment Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-green-700 font-medium">Payment ID:</span>
                  <p className="text-green-600 font-mono text-xs break-all">
                    {paymentDetails?.payment_intent_id}
                  </p>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Amount:</span>
                  <p className="text-green-600 font-semibold">
                    ${paymentDetails?.amount?.toLocaleString()} USD
                  </p>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Campaign:</span>
                  <p className="text-green-600">{paymentDetails?.campaign_type?.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Status:</span>
                  <p className="text-green-600 font-semibold">CONFIRMED</p>
                </div>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                What happens next?
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Partnership Activation</p>
                    <p className="text-sm text-muted-foreground">
                      Your partnership will be activated within {paymentDetails?.delivery_time || '24-48 hours'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Success Manager Assignment</p>
                    <p className="text-sm text-muted-foreground">
                      A dedicated success manager will contact you within 24 hours
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Integration Support</p>
                    <p className="text-sm text-muted-foreground">
                      Technical integration and onboarding support begins immediately
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button asChild className="w-full">
                <a href="/dashboard">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </a>
              </Button>
              
              <Button variant="outline" className="w-full" asChild>
                <a href={`/receipt/${paymentDetails?.payment_intent_id}`}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Receipt
                </a>
              </Button>
            </div>

            {/* Support Information */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Questions about your partnership? 
                <br />
                <a href="mailto:partnerships@coinrailz.com" className="text-blue-600 hover:underline">
                  Contact our partnerships team
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}