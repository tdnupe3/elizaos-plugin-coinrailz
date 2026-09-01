import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Send, 
  X, 
  Bot, 
  User, 
  Minimize2, 
  Maximize2,
  TrendingUp,
  CreditCard,
  Wallet,
  Shield
} from "@/lib/icons";

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface ChatWidgetProps {
  isDemo?: boolean;
}

export function ChatWidget({ isDemo = false }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'agent',
      content: `Hello! I'm your Coin Railz AI assistant. I can help you with transactions, crypto trading, account management, and compliance questions. ${isDemo ? 'Since you\'re in demo mode, I\'ll show you how everything works with sample data.' : 'How can I assist you today?'}`,
      timestamp: new Date(),
      suggestions: [
        "How do I send money?",
        "Check my crypto portfolio",
        "What are the fees?",
        "Help with compliance"
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const agentResponse = generateAIResponse(inputValue, isDemo);
      setMessages(prev => [...prev, agentResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    handleSendMessage();
  };

  const generateAIResponse = (userInput: string, isDemoMode: boolean): Message => {
    const input = userInput.toLowerCase();
    let content = "";
    let suggestions: string[] = [];

    if (input.includes("send money") || input.includes("transfer")) {
      content = isDemoMode 
        ? "In demo mode, you can test sending money through 5 platforms: Zelle, Venmo, Cash App, PayPal, and Coin Railz. Try the 'Send Money' feature to see how it works with sample data."
        : "I can help you send money through multiple platforms. Would you like to send via Zelle, Venmo, Cash App, PayPal, or directly through Coin Railz?";
      suggestions = ["Show send money options", "What are the fees?", "How long does it take?"];
    } else if (input.includes("crypto") || input.includes("portfolio") || input.includes("bitcoin") || input.includes("ethereum")) {
      content = isDemoMode
        ? "Your demo portfolio shows: BTC ($2,553), ETH ($3,951), ADA ($2,420), DOT ($1,155), USDC ($500). Total value: $10,579. You can buy, sell, or swap any of these assets."
        : "I can help you manage your crypto portfolio. You can buy, sell, swap cryptocurrencies, or check your current holdings and performance.";
      suggestions = ["Buy crypto", "Check portfolio value", "Swap cryptocurrencies"];
    } else if (input.includes("fee") || input.includes("cost") || input.includes("price")) {
      content = "Coin Railz fees: Send Money (1% min $0.32), Crypto transactions (1.5% min $1.40), DEX swaps (0.5% min $0.40), P2P crypto transfers (0.25%). All fees are transparent and competitive.";
      suggestions = ["Calculate specific fee", "Compare with other platforms", "Fee-free options"];
    } else if (input.includes("compliance") || input.includes("kyc") || input.includes("verification")) {
      content = isDemoMode
        ? "Demo account shows full KYC verification completed. In live mode, we use bank-grade compliance with automated AML/KYC, FATF Travel Rule compliance, and OFAC screening."
        : "Your account compliance status shows all required verifications. We maintain ISO 20022 compliance, FATF Travel Rule adherence, and bank-grade security protocols.";
      suggestions = ["Check verification status", "Update documents", "Compliance requirements"];
    } else if (input.includes("help") || input.includes("how")) {
      content = "I can assist with: Account management, sending/receiving money, crypto trading, portfolio analysis, fee calculations, compliance questions, and platform navigation. What specific area do you need help with?";
      suggestions = ["Account settings", "Transaction help", "Security features", "Platform tour"];
    } else {
      content = isDemoMode
        ? "I'm here to help you explore Coin Railz in demo mode. You can test all features with sample data including money transfers, crypto trading, and portfolio management."
        : "I understand you're asking about our platform. I can help with transactions, crypto management, account settings, compliance, and general platform questions. Could you be more specific?";
      suggestions = ["Platform overview", "Feature walkthrough", "Getting started"];
    }

    return {
      id: Date.now().toString(),
      type: 'agent',
      content,
      timestamp: new Date(),
      suggestions
    };
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-6 right-6 z-50 shadow-xl transition-all duration-300 ${
      isMinimized ? 'w-80 h-16' : 'w-96 h-[500px]'
    }`}>
      <CardHeader className="flex flex-row items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <CardTitle className="text-sm font-medium">
            Coin Railz AI Assistant {isDemo && <Badge variant="secondary" className="ml-2 text-xs">Demo</Badge>}
          </CardTitle>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-6 h-6 text-white hover:bg-white/20"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 h-[calc(100%-4rem)] flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {message.type === 'agent' && <Bot className="w-4 h-4 mt-0.5 text-blue-600" />}
                      {message.type === 'user' && <User className="w-4 h-4 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-sm">{message.content}</p>
                        {message.suggestions && (
                          <div className="mt-2 space-y-1">
                            {message.suggestions.map((suggestion, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="text-xs h-6 px-2 mr-1 mb-1"
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Bot className="w-4 h-4 text-blue-600" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything about Coin Railz..."
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}