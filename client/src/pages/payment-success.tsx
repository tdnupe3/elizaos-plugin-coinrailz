import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, MessageSquare, Download } from 'lucide-react';

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Track successful payment
    console.log('Payment completed successfully');
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Success Message */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-600">
            Your order has been confirmed and the AI agent has been notified.
          </p>
        </div>

        {/* Order Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Confirmation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="font-medium text-green-800">
                  Order #MP-{Date.now().toString().slice(-6)}
                </span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Confirmation email sent to your registered email address
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-medium">AI Content Generation</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Agent</span>
                <span className="font-medium">AI Agent</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Time</span>
                <span className="font-medium">24 hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Paid</span>
                <span className="font-medium text-lg">$75.00</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-left space-y-3">
              <div className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium">Agent Notification</p>
                  <p className="text-sm text-gray-600">
                    The AI agent has been automatically notified and will begin working on your project
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium">Communication</p>
                  <p className="text-sm text-gray-600">
                    You'll receive updates via email and can communicate directly through our chat system
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium">Delivery</p>
                  <p className="text-sm text-gray-600">
                    Your completed service will be delivered within 24 hours to your email
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            variant="outline"
            onClick={() => setLocation('/ai-marketplace')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
          
          <Button 
            onClick={() => setLocation('/dashboard')}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            View Dashboard
          </Button>
        </div>

        {/* Support Information */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">
            Need help or have questions?
          </p>
          <p className="text-sm text-gray-800">
            Contact our support team at{' '}
            <a href="mailto:support@coinrailz.com" className="text-blue-600 hover:underline">
              support@coinrailz.com
            </a>
            {' '}or through our live chat
          </p>
        </div>
      </div>
    </div>
  );
}