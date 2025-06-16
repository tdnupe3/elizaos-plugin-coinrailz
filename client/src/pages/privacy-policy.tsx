import { ArrowLeft, Shield, Database, Eye, Lock } from "@/lib/icons";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PrivacyPolicy() {
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
            <Shield className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-gray-600 mt-1">Last updated: June 6, 2025</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Section 1: Information We Collect */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">1</span>
                Information We Collect
                <Database className="w-5 h-5 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold text-gray-800">Personal Information</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Name, email address, and contact information</li>
                <li>Government-issued identification for KYC compliance</li>
                <li>Banking and payment information</li>
                <li>Cryptocurrency wallet addresses</li>
                <li>Transaction history and financial data</li>
              </ul>
              
              <h4 className="font-semibold text-gray-800">Technical Information</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>IP addresses and device information</li>
                <li>Browser type and usage analytics</li>
                <li>Session data and authentication tokens</li>
                <li>API usage patterns and performance metrics</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 2: How We Use Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">2</span>
                How We Use Your Information
                <Eye className="w-5 h-5 text-green-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold text-gray-800">Service Provision</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Process financial transactions and payments</li>
                <li>Verify identity and comply with KYC/AML requirements</li>
                <li>Provide AI agent marketplace services</li>
                <li>Maintain account security and fraud prevention</li>
              </ul>
              
              <h4 className="font-semibold text-gray-800">Legal Compliance</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Meet regulatory reporting requirements</li>
                <li>Respond to lawful government requests</li>
                <li>Investigate suspicious activities</li>
                <li>Maintain transaction records as required by law</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 3: Data Protection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">3</span>
                Data Protection Measures
                <Lock className="w-5 h-5 text-purple-600" />
                <Badge variant="secondary">Security</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">Security Standards</h4>
                <ul className="list-disc ml-6 space-y-1 text-green-700 text-sm">
                  <li>End-to-end encryption for all sensitive data</li>
                  <li>Multi-factor authentication requirements</li>
                  <li>Regular security audits and penetration testing</li>
                  <li>Secure cloud infrastructure with backup systems</li>
                </ul>
              </div>
              
              <h4 className="font-semibold text-gray-800">Data Retention</h4>
              <p className="text-gray-700 leading-relaxed">
                We retain personal information only as long as necessary for legal compliance and service provision. 
                Financial records are maintained per regulatory requirements, typically 5-7 years.
              </p>
            </CardContent>
          </Card>

          {/* Section 4: Data Sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">4</span>
                When We Share Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-800 mb-2">Limited Sharing Circumstances</h4>
                <ul className="list-disc ml-6 space-y-2 text-orange-700 text-sm">
                  <li>With financial institutions to process transactions</li>
                  <li>With regulatory authorities when legally required</li>
                  <li>With law enforcement for criminal investigations</li>
                  <li>With service providers under strict confidentiality agreements</li>
                </ul>
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>We do not sell personal information</strong> to third parties for marketing or commercial purposes.
              </p>
            </CardContent>
          </Card>

          {/* Section 5: User Rights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm">5</span>
                Your Privacy Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold text-gray-800">Access and Control</h4>
              <ul className="list-disc ml-6 space-y-2 text-gray-700">
                <li>Request access to your personal information</li>
                <li>Correct inaccurate or incomplete data</li>
                <li>Request deletion of non-essential information</li>
                <li>Opt-out of non-essential communications</li>
                <li>Export your transaction history</li>
              </ul>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> Some information cannot be deleted due to legal compliance requirements, 
                  including transaction records and KYC documentation.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">6</span>
                Privacy Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Data Protection Officer</h4>
                <p className="text-gray-700 text-sm">
                  Kellogg Holdings LLC<br />
                  Privacy Department<br />
                  Email: privacy@coinrailz.com<br />
                  Response Time: 3-5 business days
                </p>
              </div>
              
              <p className="text-gray-700 text-sm">
                For urgent privacy concerns or data breach reports, contact us immediately at the above email address.
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
            <div className="text-right">
              <p className="text-sm text-gray-500">Effective Date: June 6, 2025</p>
              <Link href="/terms-of-service">
                <Button variant="link" size="sm" className="text-xs">
                  View Terms of Service
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}