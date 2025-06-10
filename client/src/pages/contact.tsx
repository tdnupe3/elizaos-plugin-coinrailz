import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Send, 
  ArrowLeft,
  MessageCircle,
  Shield,
  CreditCard,
  Bot,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

export default function Contact() {
  const [form, setForm] = useState<ContactForm>({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast({
          title: "Message Sent Successfully",
          description: "We'll get back to you within 24 hours.",
        });
        setForm({
          name: '',
          email: '',
          subject: '',
          category: '',
          message: ''
        });
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast({
        title: "Message Failed",
        description: "Please try again or email us directly at support@coinrailz.com",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ContactForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Contact Support
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get help with your account, payments, or technical issues. Our team is here to assist you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* Contact Information */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    Get in Touch
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">Email Support</p>
                      <a 
                        href="mailto:support@coinrailz.com" 
                        className="text-blue-600 hover:underline text-sm"
                      >
                        support@coinrailz.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">Response Time</p>
                      <p className="text-sm text-gray-600">Within 24 hours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">Security</p>
                      <p className="text-sm text-gray-600">Encrypted communication</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Help Categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-green-600" />
                    Quick Help
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Payment Issues</p>
                      <p className="text-xs text-gray-600">Transaction problems</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <Bot className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="font-medium text-sm">AI Agent Support</p>
                      <p className="text-xs text-gray-600">Agent registration help</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <Shield className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="font-medium text-sm">Security Concerns</p>
                      <p className="text-xs text-gray-600">Account security</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="font-medium text-sm">Technical Issues</p>
                      <p className="text-xs text-gray-600">Platform problems</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    Send us a Message
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Fill out the form below and we'll get back to you as soon as possible.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="your.email@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select onValueChange={(value) => handleInputChange('category', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select inquiry type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Inquiry</SelectItem>
                          <SelectItem value="technical">Technical Support</SelectItem>
                          <SelectItem value="payment">Payment Issues</SelectItem>
                          <SelectItem value="ai-agent">AI Agent Support</SelectItem>
                          <SelectItem value="security">Security Concerns</SelectItem>
                          <SelectItem value="business">Business Partnership</SelectItem>
                          <SelectItem value="compliance">Compliance & Legal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        type="text"
                        required
                        value={form.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        placeholder="Brief description of your inquiry"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        required
                        value={form.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        placeholder="Please provide details about your inquiry..."
                        rows={6}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                      >
                        {isSubmitting ? (
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {isSubmitting ? 'Sending...' : 'Send Message'}
                      </Button>
                      <p className="text-xs text-gray-500">
                        By submitting this form, you agree to our terms of service and privacy policy.
                      </p>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Emergency Contact Notice */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-red-800 mb-2">Emergency Security Issues</h3>
                  <p className="text-red-700 text-sm mb-2">
                    If you're experiencing unauthorized account access, suspicious transactions, or security breaches,
                    please email us immediately at <strong>support@coinrailz.com</strong> with "URGENT SECURITY" in the subject line.
                  </p>
                  <p className="text-red-600 text-xs">
                    For immediate assistance with compromised accounts, include your account ID and a description of the security concern.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}