import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import { 
  MessageCircle, 
  Mail, 
  Phone, 
  X, 
  HelpCircle,
  AlertCircle,
  CreditCard,
  Bot
} from 'lucide-react';

export default function ContactWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const quickHelpItems = [
    {
      icon: CreditCard,
      title: 'Payment Issues',
      description: 'Transaction problems or payment failures',
      link: '/contact-us?category=payment'
    },
    {
      icon: Bot,
      title: 'AI Agent Support',
      description: 'Agent registration and marketplace help',
      link: '/contact-us?category=ai-agent'
    },
    {
      icon: AlertCircle,
      title: 'Security Concerns',
      description: 'Account security and suspicious activity',
      link: '/contact-us?category=security'
    },
    {
      icon: HelpCircle,
      title: 'General Support',
      description: 'All other questions and inquiries',
      link: '/contact-us?category=general'
    }
  ];

  return (
    <>
      {/* Floating contact button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-300"
          size="sm"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageCircle className="w-6 h-6" />
          )}
        </Button>
      </div>

      {/* Contact popup */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40">
          <Card className="w-80 shadow-xl border-0 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                Need Help?
              </CardTitle>
              <p className="text-sm text-gray-600">
                Get support for your account, payments, or technical issues
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick help options */}
              <div className="space-y-2">
                {quickHelpItems.map((item, index) => (
                  <Link key={index} href={item.link}>
                    <div 
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-600 truncate">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Direct contact options */}
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email Support</p>
                    <a 
                      href="mailto:support@coinrailz.com" 
                      className="text-xs text-blue-600 hover:underline"
                    >
                      support@coinrailz.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Response Time</p>
                    <p className="text-xs text-gray-600">Within 24 hours</p>
                  </div>
                </div>
              </div>

              {/* Full contact form button */}
              <Link href="/contact-us">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setIsOpen(false)}
                >
                  Full Contact Form
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}