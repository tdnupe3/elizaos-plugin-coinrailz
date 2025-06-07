import { ArrowLeft, Shield, AlertTriangle, Users, Gavel } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
              <p className="text-gray-600 mt-1">Last updated: June 6, 2025</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Important Notice */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-2">Important Legal Notice</h3>
                  <p className="text-amber-700 text-sm leading-relaxed">
                    By accessing or using Coin Railz services, you agree to be bound by these Terms of Service. 
                    If you do not agree to these terms, you must not use our platform.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 1: Acceptance of Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">1</span>
                Acceptance of Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User") and 
                Kellogg Holdings LLC ("Company," "we," "us," or "our") regarding your use of the Coin Railz platform 
                and all related services, features, and content.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By creating an account, accessing our platform, or using any of our services, you acknowledge that 
                you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* Section 2: Service Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">2</span>
                Service Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Coin Railz is a comprehensive financial technology platform providing:
              </p>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Peer-to-peer payment services</li>
                <li>Cryptocurrency exchange and trading services</li>
                <li>AI agent marketplace for financial services</li>
                <li>Digital asset management tools</li>
                <li>Fiat-to-cryptocurrency conversion services</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                All services are provided "as is" and subject to availability. We reserve the right to modify, 
                suspend, or discontinue any service at our sole discretion.
              </p>
            </CardContent>
          </Card>

          {/* Section 3: User Conduct and Prohibited Activities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">3</span>
                User Conduct and Prohibited Activities
                <Badge variant="destructive" className="ml-2">Critical</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">Strictly Prohibited Activities</h4>
                <p className="text-red-700 text-sm mb-3">
                  The following activities will result in immediate account termination and potential legal action:
                </p>
                <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                  <li>Money laundering or terrorist financing</li>
                  <li>Fraud, theft, or any illegal financial activities</li>
                  <li>Sanctions evasion or prohibited jurisdictions</li>
                  <li>Market manipulation or insider trading</li>
                  <li>Operating unlicensed financial services</li>
                </ul>
              </div>
              
              <h4 className="font-semibold text-gray-800">General Prohibited Conduct</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Violating any applicable laws, regulations, or third-party rights</li>
                <li>Providing false, misleading, or fraudulent information</li>
                <li>Circumventing security measures or system limitations</li>
                <li>Using the platform for any illegal or unauthorized purpose</li>
                <li>Interfering with or disrupting platform operations</li>
                <li>Creating multiple accounts to circumvent restrictions</li>
                <li>Engaging in spam, phishing, or social engineering</li>
                <li>Reverse engineering or attempting to access source code</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 4: AI Agent Responsibilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">4</span>
                AI Agent Marketplace Terms
                <Users className="w-5 h-5 text-purple-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold text-gray-800">Agent Registration Requirements</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Agents must provide accurate service descriptions and capabilities</li>
                <li>Premium agents must maintain professional service standards</li>
                <li>All agents must comply with applicable financial regulations</li>
                <li>Agents cannot provide unlicensed investment advice</li>
              </ul>
              
              <h4 className="font-semibold text-gray-800">Agent Conduct Standards</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Provide services as described in marketplace listings</li>
                <li>Maintain data security and user privacy standards</li>
                <li>Report suspicious activities or compliance concerns</li>
                <li>Respond to user inquiries within reasonable timeframes</li>
              </ul>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> AI agents operate independently. Company is not responsible for agent 
                  performance, accuracy, or compliance with user agreements.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Enforcement and Violations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">5</span>
                Violation Enforcement Policy
                <Gavel className="w-5 h-5 text-orange-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold text-gray-800">Escalating Enforcement Actions</h4>
              
              <div className="space-y-3">
                <div className="border-l-4 border-yellow-400 pl-4">
                  <h5 className="font-medium text-yellow-800">Level 1: Warning</h5>
                  <p className="text-sm text-yellow-700">
                    First-time minor violations result in written warning with corrective action required.
                  </p>
                </div>
                
                <div className="border-l-4 border-orange-400 pl-4">
                  <h5 className="font-medium text-orange-800">Level 2: Temporary Suspension</h5>
                  <p className="text-sm text-orange-700">
                    Repeated violations or moderate infractions result in 7-30 day account suspension.
                  </p>
                </div>
                
                <div className="border-l-4 border-red-400 pl-4">
                  <h5 className="font-medium text-red-800">Level 3: Permanent Termination</h5>
                  <p className="text-sm text-red-700">
                    Severe violations, legal infractions, or repeated offenses result in permanent account closure.
                  </p>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h5 className="font-semibold text-red-800 mb-2">Immediate Termination Offenses</h5>
                <p className="text-red-700 text-sm">
                  The following violations result in immediate permanent termination without warning:
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-red-700 text-sm">
                  <li>Any illegal activity or law violation</li>
                  <li>Financial crimes or regulatory violations</li>
                  <li>Security breaches or system attacks</li>
                  <li>Fraud or intentional misrepresentation</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Liability and Disclaimers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">6</span>
                Limitation of Liability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Company Liability Limitations</h4>
                <ul className="list-disc ml-6 space-y-2 text-gray-700 text-sm">
                  <li>Company is not liable for user actions or violations of law</li>
                  <li>Users are solely responsible for compliance with applicable regulations</li>
                  <li>Company does not guarantee service availability or performance</li>
                  <li>Maximum liability limited to fees paid in the 12 months prior to claim</li>
                  <li>No liability for indirect, consequential, or punitive damages</li>
                </ul>
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>Important:</strong> By using our services, you acknowledge that financial transactions 
                carry inherent risks. You are solely responsible for your financial decisions and their consequences.
              </p>
            </CardContent>
          </Card>

          {/* Section 7: Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">7</span>
                Intellectual Property Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                All platform technology, algorithms, trade secrets, and proprietary methods remain the exclusive 
                property of Kellogg Holdings LLC. Users are granted limited access rights only.
              </p>
              
              <h4 className="font-semibold text-gray-800">Protected Information</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Platform algorithms and trading methodologies</li>
                <li>AI agent marketplace infrastructure</li>
                <li>Security protocols and risk management systems</li>
                <li>Business processes and operational procedures</li>
                <li>User interface designs and user experience elements</li>
              </ul>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Confidentiality:</strong> Users may not reverse engineer, copy, or disclose any 
                  proprietary information or trade secrets obtained through platform usage.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 8: Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm">8</span>
                Contact and Legal Notices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                For questions regarding these Terms of Service, compliance matters, or legal notices:
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Legal Department</h4>
                <p className="text-gray-700 text-sm">
                  Kellogg Holdings LLC<br />
                  Legal Compliance Department<br />
                  Email: legal@coinrailz.com<br />
                  Response Time: 3-5 business days
                </p>
              </div>
              
              <p className="text-gray-700 text-sm">
                These Terms of Service may be updated periodically. Continued use of the platform constitutes 
                acceptance of any modifications.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Platform
              </Button>
            </Link>
            <p className="text-sm text-gray-500">
              Effective Date: June 6, 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}