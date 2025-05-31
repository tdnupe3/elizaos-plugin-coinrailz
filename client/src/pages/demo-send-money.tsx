import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowLeft, DollarSign, Clock, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function DemoSendMoney() {
  const [, setLocation] = useLocation();
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientPlatform, setRecipientPlatform] = useState("");
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setShowSuccess(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setShowSuccess(false);
      setAmount("");
      setRecipient("");
      setRecipientPlatform("");
      setMessage("");
      setMethod("");
    }, 3000);
  };

  const calculateFee = () => {
    const amt = parseFloat(amount) || 0;
    if (method === "instant") return amt * 0.015; // 1.5%
    if (method === "standard") return Math.max(0.25, amt * 0.005); // $0.25 or 0.5%
    return 0;
  };

  const fee = calculateFee();
  const total = (parseFloat(amount) || 0) + fee;

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Sent!</h2>
            <p className="text-gray-600 mb-4">
              ${amount} has been sent to {recipient}
            </p>
            <Badge variant="secondary" className="mb-4">
              Demo Mode - No actual money transferred
            </Badge>
            <Button onClick={() => setLocation('/demo')} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/demo')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Demo
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Send Money</h1>
                <p className="text-sm text-gray-600">Demo Mode - No real transactions</p>
              </div>
            </div>
            <Badge variant="outline">Demo</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Send className="w-5 h-5" />
              <span>Send Money Demo</span>
            </CardTitle>
            <p className="text-sm text-gray-600">
              Experience our money transfer interface - completely safe in demo mode
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="platform">Recipient's Payment Platform</Label>
                <Select value={recipientPlatform} onValueChange={setRecipientPlatform} required>
                  <SelectTrigger style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}>
                    <SelectValue placeholder="Select payment platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="cashapp">Cash App</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="coinrailz">Coin Railz (Internal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient">
                  {recipientPlatform === "zelle" && "Recipient's Email or Phone"}
                  {recipientPlatform === "venmo" && "Venmo Username or Phone"}
                  {recipientPlatform === "cashapp" && "Cash App $Cashtag or Phone"}
                  {recipientPlatform === "paypal" && "PayPal Email Address"}
                  {recipientPlatform === "coinrailz" && "Coin Railz User ID or Email"}
                  {!recipientPlatform && "Recipient Identifier"}
                </Label>
                <Input
                  id="recipient"
                  type="text"
                  placeholder={
                    recipientPlatform === "zelle" ? "john@example.com or +1 555-0123" :
                    recipientPlatform === "venmo" ? "@johnsmith or +1 555-0123" :
                    recipientPlatform === "cashapp" ? "$johnsmith or +1 555-0123" :
                    recipientPlatform === "paypal" ? "john@example.com" :
                    recipientPlatform === "coinrailz" ? "john@example.com or CR123456" :
                    "Select platform first"
                  }
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={!recipientPlatform}
                  style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}
                  required
                />
                {recipientPlatform && (
                  <p className="text-xs text-gray-500">
                    {recipientPlatform === "zelle" && "Enter the email or phone number registered with Zelle"}
                    {recipientPlatform === "venmo" && "Enter Venmo username (with @) or phone number"}
                    {recipientPlatform === "cashapp" && "Enter Cash App $cashtag (with $) or phone number"}
                    {recipientPlatform === "paypal" && "Enter the email address associated with PayPal account"}
                    {recipientPlatform === "coinrailz" && "Enter Coin Railz user ID or registered email"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    className="pl-10"
                    style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                    min="0.01"
                    max="2500"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">Maximum $2,500 per transaction in demo</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Transfer Method</Label>
                <Select value={method} onValueChange={setMethod} required>
                  <SelectTrigger style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}>
                    <SelectValue placeholder="Choose transfer speed" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">
                      <div className="flex items-center justify-between w-full">
                        <span>Standard (1-3 business days)</span>
                        <Clock className="w-4 h-4 ml-2" />
                      </div>
                    </SelectItem>
                    <SelectItem value="instant">
                      <div className="flex items-center justify-between w-full">
                        <span>Instant (within minutes)</span>
                        <Send className="w-4 h-4 ml-2" />
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a note for the recipient"
                  style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                />
              </div>

              {amount && method && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium text-gray-900">Transaction Summary</h3>
                  <div className="flex justify-between text-sm">
                    <span>Amount:</span>
                    <span>${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Fee:</span>
                    <span>${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 font-medium">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !amount || !recipient || !recipientPlatform || !method}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Processing Demo Transaction...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Money (Demo)
                  </>
                )}
              </Button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Demo Mode:</strong> This is a demonstration interface. No real money will be transferred, 
                  and no actual accounts will be charged.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}