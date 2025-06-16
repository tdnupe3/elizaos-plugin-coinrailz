import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle, Lock, Database, UserCheck, Key, Eye, ArrowRight } from "@/lib/icons";

interface SignupStep {
  step: number;
  title: string;
  description: string;
  security: string;
  completed: boolean;
}

export default function SignupFlowDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  
  const signupSteps: SignupStep[] = [
    {
      step: 1,
      title: "Landing Page - User Choice",
      description: "User clicks 'Sign Up' or 'Sign In' button",
      security: "Both redirect to same secure Replit OpenID Connect flow",
      completed: false
    },
    {
      step: 2,
      title: "Replit OpenID Connect",
      description: "Secure authentication through Replit's OAuth system",
      security: "Enterprise-grade OAuth 2.0 with PKCE protection",
      completed: false
    },
    {
      step: 3,
      title: "Token Exchange",
      description: "Server receives secure tokens and user claims",
      security: "JWT tokens with refresh capability, signed by Replit",
      completed: false
    },
    {
      step: 4,
      title: "Database Upsert",
      description: "User information securely stored in PostgreSQL",
      security: "Encrypted at rest, PCI DSS compliant storage",
      completed: false
    },
    {
      step: 5,
      title: "Session Creation",
      description: "Secure session established with database backing",
      security: "PostgreSQL session store, HttpOnly cookies",
      completed: false
    },
    {
      step: 6,
      title: "KYC & Compliance",
      description: "Risk assessment and compliance checks initiated",
      security: "AML screening, sanctions check, PEPs verification",
      completed: false
    }
  ];

  const dataSecurityFeatures = [
    {
      icon: <Database className="w-5 h-5 text-blue-600" />,
      title: "Database Encryption",
      description: "All user data encrypted at rest using AES-256"
    },
    {
      icon: <Lock className="w-5 h-5 text-green-600" />,
      title: "Session Security",
      description: "HttpOnly cookies, secure flags, database-backed sessions"
    },
    {
      icon: <Shield className="w-5 h-5 text-purple-600" />,
      title: "Compliance Framework",
      description: "PCI DSS, SOC 2, ISO 27001 compliance ready"
    },
    {
      icon: <UserCheck className="w-5 h-5 text-orange-600" />,
      title: "Identity Verification",
      description: "KYC/AML with sanctions and PEPs screening"
    }
  ];

  const nextStep = () => {
    if (currentStep < signupSteps.length - 1) {
      const newSteps = [...signupSteps];
      newSteps[currentStep].completed = true;
      setCurrentStep(currentStep + 1);
    }
  };

  const actualSignup = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Signup Flow</h1>
          <p className="text-gray-600">Enterprise-grade authentication and data protection</p>
        </div>

        {/* Current Step Display */}
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    {signupSteps[currentStep].step}
                  </span>
                  <span>{signupSteps[currentStep].title}</span>
                </CardTitle>
                <CardDescription className="mt-2">
                  {signupSteps[currentStep].description}
                </CardDescription>
              </div>
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <Lock className="w-4 h-4" />
              <AlertDescription>
                <strong>Security:</strong> {signupSteps[currentStep].security}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex space-x-3">
              <Button 
                onClick={nextStep} 
                disabled={currentStep === signupSteps.length - 1}
                className="flex items-center space-x-2"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              {currentStep === signupSteps.length - 1 && (
                <Button onClick={actualSignup} variant="outline">
                  Try Actual Signup
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signupSteps.map((step, index) => (
            <Card 
              key={step.step} 
              className={`transition-all ${
                index === currentStep 
                  ? 'ring-2 ring-blue-600 bg-blue-50' 
                  : step.completed 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={step.completed ? "default" : index === currentStep ? "secondary" : "outline"}
                    className={step.completed ? "bg-green-600" : ""}
                  >
                    Step {step.step}
                  </Badge>
                  {step.completed && <CheckCircle className="w-5 h-5 text-green-600" />}
                </div>
                <CardTitle className="text-sm">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data Security Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-6 h-6 text-blue-600" />
              <span>Data Security & Storage</span>
            </CardTitle>
            <CardDescription>
              How your information is protected throughout the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dataSecurityFeatures.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{feature.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Database Schema Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-6 h-6 text-purple-600" />
              <span>User Data Schema</span>
            </CardTitle>
            <CardDescription>
              Secure storage structure for user information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <div className="space-y-1">
                <div><span className="text-blue-400">users</span> table &#123;</div>
                <div className="ml-2"><span className="text-yellow-400">id:</span> varchar (primary key) - Replit user ID</div>
                <div className="ml-2"><span className="text-yellow-400">email:</span> varchar (encrypted)</div>
                <div className="ml-2"><span className="text-yellow-400">firstName:</span> varchar</div>
                <div className="ml-2"><span className="text-yellow-400">lastName:</span> varchar</div>
                <div className="ml-2"><span className="text-yellow-400">kycStatus:</span> varchar (pending/verified/rejected)</div>
                <div className="ml-2"><span className="text-yellow-400">riskScore:</span> integer (0-100 compliance score)</div>
                <div className="ml-2"><span className="text-yellow-400">sanctionsCheck:</span> boolean</div>
                <div className="ml-2"><span className="text-yellow-400">pepsCheck:</span> boolean</div>
                <div className="ml-2"><span className="text-yellow-400">complianceLevel:</span> varchar (basic/enhanced)</div>
                <div className="ml-2"><span className="text-yellow-400">createdAt:</span> timestamp</div>
                <div className="ml-2"><span className="text-yellow-400">updatedAt:</span> timestamp</div>
                <div>&#125;</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guest vs Authenticated Differentiation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-6 h-6 text-orange-600" />
              <span>User Access Levels</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                <h3 className="font-semibold text-orange-800 mb-3">Guest Users</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-orange-600" />
                    <span>DEX aggregator access</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-orange-600" />
                    <span>Demo mode features</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-orange-600" />
                    <span>Public portfolio viewing</span>
                  </li>
                  <li className="text-gray-500">❌ No money transfers</li>
                  <li className="text-gray-500">❌ No crypto purchases</li>
                  <li className="text-gray-500">❌ No account persistence</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <h3 className="font-semibold text-green-800 mb-3">Authenticated Users</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Full platform access</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Send/receive money</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Buy/sell cryptocurrency</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Referral program</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Transaction history</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>MFA security</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}