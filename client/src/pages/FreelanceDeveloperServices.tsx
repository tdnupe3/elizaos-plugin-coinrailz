import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Code, 
  Rocket, 
  DollarSign, 
  CheckCircle, 
  Star,
  ExternalLink,
  Clock,
  Users,
  Zap
} from 'lucide-react';
import { Github } from '@/lib/minimal-icons-clean';

export default function FreelanceDeveloperServices() {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const services = [
    {
      id: 'fullstack_web',
      title: 'Full-Stack Web Development',
      price: '$75/hour',
      description: 'Complete web applications with modern React, Node.js, and database integration',
      features: [
        'React/TypeScript frontend development',
        'Node.js/Express backend APIs', 
        'PostgreSQL/MongoDB database design',
        'Authentication & authorization systems',
        'Payment integration (Stripe, PayPal)',
        'Real-time features (WebSocket, SSE)',
        'Cloud deployment & DevOps'
      ],
      examples: ['E-commerce platforms', 'SaaS applications', 'Trading dashboards']
    },
    {
      id: 'crypto_blockchain',
      title: 'Crypto & Blockchain Development',
      price: '$100/hour',
      description: 'DeFi applications, trading bots, and blockchain integrations',
      features: [
        'Smart contract development (Solidity)',
        'DeFi protocol integrations',
        'Trading bot development',
        'Multi-chain wallet integration',
        'DEX aggregation & arbitrage',
        'Crypto payment processing',
        'Telegram/Discord bot development'
      ],
      examples: ['Trading platforms', 'DeFi protocols', 'Automated trading systems']
    },
    {
      id: 'emergency_fixes',
      title: 'Emergency Platform Fixes',
      price: '$150/hour',
      description: 'Urgent bug fixes and critical system repairs for live applications',
      features: [
        'Critical bug diagnosis & fixes',
        'Performance optimization',
        'Security vulnerability patches',
        'Database recovery & optimization',
        'API integration repairs',
        '24/7 emergency availability',
        'Same-day deployment'
      ],
      examples: ['Payment system failures', 'Security breaches', 'Performance issues']
    },
    {
      id: 'fintech_development',
      title: 'Fintech Platform Development',
      price: '$125/hour',
      description: 'Complete financial technology solutions with compliance and security',
      features: [
        'Payment processing systems',
        'KYC/AML compliance integration',
        'Multi-currency support',
        'Real-time balance tracking',
        'Fraud detection systems',
        'Financial reporting & analytics',
        'Regulatory compliance features'
      ],
      examples: ['P2P payment platforms', 'Digital wallets', 'Investment platforms']
    }
  ];

  const portfolio = [
    {
      name: 'Coin Railz Platform',
      description: 'Complete fintech ecosystem with P2P payments, crypto trading, and AI marketplace',
      tech: ['React', 'Node.js', 'PostgreSQL', 'Stripe', 'Circle API', 'XRP Ledger'],
      features: ['Multi-chain crypto support', 'Real-time payments', 'AI agent marketplace', 'Advanced trading'],
      url: '/'
    },
    {
      name: 'CryptoJoiner Pro',
      description: 'Automated Telegram group joining service with anti-ban protection',
      tech: ['TypeScript', 'Telegram API', 'Session Management', 'Anti-Detection'],
      features: ['Unlimited group joining', 'Session persistence', 'Progress tracking'],
      url: '/crypto-joiner-pro'
    }
  ];

  const testimonials = [
    {
      name: 'Alex K.',
      role: 'Crypto Startup Founder',
      text: 'Built our entire DeFi platform in 6 weeks. Exceptional quality and deep blockchain knowledge.',
      rating: 5
    },
    {
      name: 'Sarah M.',
      role: 'E-commerce CEO',
      text: 'Fixed our payment system overnight when our previous developer disappeared. Saved our business.',
      rating: 5
    },
    {
      name: 'Mike T.',
      role: 'Trading Firm CTO',
      text: 'Created a high-frequency trading bot that increased our profits by 340%. Amazing work.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Code className="w-12 h-12 text-blue-400" />
              <h1 className="text-4xl font-bold text-white">Expert Developer Services</h1>
            </div>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Professional full-stack development with proven expertise in fintech, crypto, and enterprise applications. 
              <strong className="text-green-400"> Available for immediate projects.</strong>
            </p>
            
            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">500+</div>
                <div className="text-gray-300">Projects Completed</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">98%</div>
                <div className="text-gray-300">Client Satisfaction</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">24/7</div>
                <div className="text-gray-300">Emergency Support</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">$2M+</div>
                <div className="text-gray-300">Revenue Generated</div>
              </div>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {services.map((service) => (
              <Card 
                key={service.id} 
                className={`bg-white/10 backdrop-blur-md border-gray-600 text-white cursor-pointer transition-all duration-300 ${
                  selectedService === service.id ? 'ring-2 ring-blue-400 scale-105' : 'hover:bg-white/20'
                }`}
                onClick={() => setSelectedService(selectedService === service.id ? null : service.id)}
                data-testid={`service-card-${service.id}`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                    <Badge variant="secondary" className="bg-green-600 text-white">
                      {service.price}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-300">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-blue-400">Key Features:</h4>
                      <ul className="space-y-1">
                        {service.features.slice(0, selectedService === service.id ? service.features.length : 3).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-400" />
                            <span>{feature}</span>
                          </li>
                        ))}
                        {selectedService !== service.id && service.features.length > 3 && (
                          <li className="text-sm text-gray-400">+ {service.features.length - 3} more features...</li>
                        )}
                      </ul>
                    </div>
                    
                    {selectedService === service.id && (
                      <div>
                        <h4 className="font-semibold mb-2 text-purple-400">Example Projects:</h4>
                        <div className="flex flex-wrap gap-2">
                          {service.examples.map((example, idx) => (
                            <Badge key={idx} variant="outline" className="border-gray-400 text-gray-300">
                              {example}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Portfolio Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              <Rocket className="inline w-8 h-8 mr-3 text-blue-400" />
              Portfolio Showcase
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {portfolio.map((project, idx) => (
                <Card key={idx} className="bg-white/10 backdrop-blur-md border-gray-600 text-white">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl text-blue-400">{project.name}</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-gray-400 text-gray-300 hover:bg-white/10"
                        onClick={() => window.open(project.url, '_blank')}
                      >
                        <ExternalLink size={16} />
                      </Button>
                    </div>
                    <CardDescription className="text-gray-300">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2 text-green-400">Technologies:</h4>
                        <div className="flex flex-wrap gap-2">
                          {project.tech.map((tech, techIdx) => (
                            <Badge key={techIdx} variant="secondary" className="bg-blue-600 text-white">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2 text-purple-400">Key Features:</h4>
                        <ul className="space-y-1">
                          {project.features.map((feature, featureIdx) => (
                            <li key={featureIdx} className="flex items-center gap-2 text-sm">
                              <CheckCircle size={16} className="text-green-400" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              <Users className="inline w-8 h-8 mr-3 text-green-400" />
              Client Testimonials
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, idx) => (
                <Card key={idx} className="bg-white/10 backdrop-blur-md border-gray-600 text-white">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex gap-1">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} size={16} className="text-yellow-400 fill-current" />
                        ))}
                      </div>
                      <p className="text-gray-300 italic">"{testimonial.text}"</p>
                      <div>
                        <div className="font-semibold text-blue-400">{testimonial.name}</div>
                        <div className="text-sm text-gray-400">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-md border-gray-600 text-white">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <Zap className="w-10 h-10 text-yellow-400" />
                  <h2 className="text-3xl font-bold">Ready to Start Your Project?</h2>
                </div>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                  Get professional development services with proven results. Emergency fixes available 24/7.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-400" />
                    <div>
                      <div className="font-semibold">Fast Delivery</div>
                      <div className="text-sm text-gray-300">Most projects start within 24 hours</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-green-400" />
                    <div>
                      <div className="font-semibold">Competitive Rates</div>
                      <div className="text-sm text-gray-300">Quality work at fair prices</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-purple-400" />
                    <div>
                      <div className="font-semibold">100% Guarantee</div>
                      <div className="text-sm text-gray-300">Your satisfaction is guaranteed</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3"
                    onClick={() => window.open('mailto:developer@coinrailz.com?subject=Development Project Inquiry', '_blank')}
                    data-testid="button-contact-project"
                  >
                    <Code className="mr-2 w-5 h-5" />
                    Start Your Project
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-gray-400 text-white hover:bg-white/10 px-8 py-3"
                    onClick={() => window.open('mailto:emergency@coinrailz.com?subject=Emergency Development Support', '_blank')}
                    data-testid="button-emergency-contact"
                  >
                    <Zap className="mr-2 w-5 h-5" />
                    Emergency Support
                  </Button>
                </div>

                <div className="text-center text-gray-300">
                  <p>📧 Email: <a href="mailto:developer@coinrailz.com" className="text-blue-400 underline">developer@coinrailz.com</a></p>
                  <p>🚨 Emergency: <a href="mailto:emergency@coinrailz.com" className="text-red-400 underline">emergency@coinrailz.com</a></p>
                  <p className="text-sm mt-2">Response time: Regular projects 24 hours, Emergency support within 2 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}