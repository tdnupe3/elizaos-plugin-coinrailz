import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Shield, Scale } from "@/lib/icons";

export default function LegalDisclaimers() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Legal Disclaimers</h1>
            <p className="text-gray-600">Important legal information and risk disclosures</p>
          </div>

          {/* Cryptocurrency Risk Disclosure */}
          <Card className="border-l-4 border-l-red-600">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-800">
                <AlertTriangle className="w-6 h-6" />
                <span>Cryptocurrency Investment Risk Disclosure</span>
              </CardTitle>
              <CardDescription>
                Important information about the risks of cryptocurrency investments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">HIGH RISK INVESTMENT WARNING</h3>
                <p className="text-sm text-red-700">
                  Cryptocurrency investments are highly speculative and involve substantial risk of loss. 
                  You should never invest money you cannot afford to lose entirely.
                </p>
              </div>
              
              <div className="space-y-3 text-sm text-gray-700">
                <h4 className="font-semibold text-gray-900">Key Risks Include:</h4>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Extreme Price Volatility:</strong> Cryptocurrency values can fluctuate dramatically within short periods</li>
                  <li><strong>Total Loss of Investment:</strong> Cryptocurrencies can become worthless without warning</li>
                  <li><strong>Regulatory Risk:</strong> Government actions may ban, restrict, or heavily regulate cryptocurrencies</li>
                  <li><strong>Technology Risk:</strong> Blockchain networks may fail, fork, or become compromised</li>
                  <li><strong>Liquidity Risk:</strong> You may not be able to sell your cryptocurrency when desired</li>
                  <li><strong>Cybersecurity Risk:</strong> Exchanges and wallets may be hacked or compromised</li>
                  <li><strong>No FDIC Insurance:</strong> Cryptocurrency holdings are not protected by deposit insurance</li>
                </ul>
              </div>

              <Separator />

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Liability Limitation</h4>
                <p className="text-sm text-yellow-700">
                  <strong>Kellogg Holdings LLC</strong> and <strong>Coin Railz</strong> provide cryptocurrency 
                  services as a technology platform only. We do not provide investment advice, recommendations, 
                  or guarantees of any kind. All investment decisions are made solely by you at your own risk.
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  <strong>DISCLAIMER OF LIABILITY:</strong> Kellogg Holdings LLC and Coin Railz disclaim 
                  all liability for any losses, damages, or adverse outcomes resulting from cryptocurrency 
                  investments, market volatility, regulatory changes, or platform usage.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AML/KYC Policy Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-blue-600" />
                <span>Anti-Money Laundering (AML) & Know Your Customer (KYC) Policy</span>
              </CardTitle>
              <CardDescription>
                Kellogg Holdings LLC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full border rounded-lg p-4">
                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">1. Purpose</h3>
                    <p className="text-gray-700">
                      Kellogg Holdings LLC ("KHLLC") is committed to maintaining the highest standards of integrity 
                      and compliance in all operations, particularly regarding Anti-Money Laundering (AML) and 
                      Know Your Customer (KYC) obligations. This policy prevents the use of our services for 
                      money laundering, terrorist financing, fraud, or other illicit activities.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">2. Customer Identification Requirements</h3>
                    <div className="space-y-2">
                      <p className="font-medium text-gray-800">Individual Clients Must Provide:</p>
                      <ul className="list-disc list-inside text-gray-700 ml-4">
                        <li>Full legal name</li>
                        <li>Date of birth</li>
                        <li>Residential address</li>
                        <li>Government-issued photo ID</li>
                        <li>Verified phone number and/or email</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">3. Transaction Monitoring</h3>
                    <p className="text-gray-700">
                       Customers are responsible for complying with laws and regulations applicable to their use
                       of the platform. Coin Railz may restrict or suspend use under its policies when activity
                       appears to violate those policies or applicable requirements.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">4. Enhanced Due Diligence</h3>
                    <p className="text-gray-700">
                      Enhanced Due Diligence (EDD) is applied for high-risk clients, large transactions, 
                      and transactions involving high-risk countries as identified by FATF or OFAC.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">5. Compliance Contact</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-800">
                        <strong>Compliance Officer:</strong> Travis Kellogg<br />
                        <strong>Phone:</strong> 205-202-1093<br />
                        <strong>Email:</strong> travis@kelloggholdings.com
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* General Terms and Disclaimers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Scale className="w-6 h-6 text-purple-600" />
                <span>General Terms and Disclaimers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Service Disclaimer</h3>
                <p className="text-sm text-gray-700">
                  Coin Railz services are provided "as is" without warranties of any kind. We do not guarantee 
                  uninterrupted service, transaction completion, or protection against losses.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Financial Advice Disclaimer</h3>
                <p className="text-sm text-gray-700">
                  Coin Railz does not provide financial, investment, tax, or legal advice. All information 
                  provided is for informational purposes only. Consult qualified professionals before making 
                  financial decisions.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Third-Party Services</h3>
                <p className="text-sm text-gray-700">
                  Coin Railz integrates with third-party services (banks, exchanges, payment processors). 
                  We are not responsible for third-party service failures, delays, or security breaches.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-600">
                  <strong>Last Updated:</strong> January 1, 2025<br />
                  <strong>Effective Date:</strong> January 1, 2025<br />
                  These disclaimers are subject to change. Users will be notified of material changes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}