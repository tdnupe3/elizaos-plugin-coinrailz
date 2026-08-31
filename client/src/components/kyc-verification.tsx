import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, CheckCircle, Clock, Upload, FileText, Camera, CreditCard, Building2, MapPin, Phone, Calendar, User } from "@/lib/icons";

interface KYCStatus {
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'review_required';
  verificationLevel: 'basic' | 'enhanced' | 'premium';
  transactionLimits: {
    daily: number;
    monthly: number;
    annual: number;
  };
  approvedAt?: Date;
  rejectionReason?: string;
  requiredDocuments?: string[];
}

interface KYCRequirements {
  required: boolean;
  documents: string[];
  limits: {
    withoutKYC: number;
    withKYC: number;
  };
}

export function KYCVerification() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    country: '',
    phoneNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    }
  });
  
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState('');

  // Fetch KYC status
  const { data: kycStatus, isLoading: statusLoading } = useQuery<{ success: boolean; status: KYCStatus }>({
    queryKey: ['/api/circle/kyc/status'],
    enabled: !!user
  });

  // Fetch KYC requirements for selected country
  const { data: requirements } = useQuery<{ success: boolean; requirements: KYCRequirements }>({
    queryKey: ['/api/circle/kyc/requirements', selectedCountry],
    enabled: !!selectedCountry
  });

  // Submit KYC verification
  const submitKYC = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/circle/kyc/submit', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "KYC Submitted Successfully",
        description: "Your verification documents have been submitted for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit KYC verification",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (documentType: string, file: File) => {
    setSelectedFiles(prev => ({
      ...prev,
      [documentType]: file
    }));
  };

  const handleSubmit = async () => {
    const formDataToSend = new FormData();
    
    // Add form data
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'address') {
        formDataToSend.append(key, JSON.stringify(value));
      } else {
        formDataToSend.append(key, String(value));
      }
    });
    
    // Add files
    Object.entries(selectedFiles).forEach(([documentType, file]) => {
      formDataToSend.append(documentType, file);
    });
    
    submitKYC.mutate(formDataToSend);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'review_required': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4" />;
      case 'review_required': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatLimit = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const status = kycStatus?.status;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Identity Verification (KYC)
          </CardTitle>
          <CardDescription>
            Complete your identity verification to unlock higher transaction limits and enhanced features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Current Status */}
          {status && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={getStatusColor(status.status)}>
                  {getStatusIcon(status.status)}
                  {status.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-600">
                  Verification Level: {status.verificationLevel}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatLimit(status.transactionLimits.daily)}
                  </div>
                  <div className="text-sm text-gray-600">Daily Limit</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatLimit(status.transactionLimits.monthly)}
                  </div>
                  <div className="text-sm text-gray-600">Monthly Limit</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatLimit(status.transactionLimits.annual)}
                  </div>
                  <div className="text-sm text-gray-600">Annual Limit</div>
                </div>
              </div>

              {status.status === 'rejected' && status.rejectionReason && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Verification Rejected:</strong> {status.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'review_required' && status.requiredDocuments && (
                <Alert className="mb-4">
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Additional Documents Required:</strong> {status.requiredDocuments.join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* KYC Form */}
          {(!status || status.status === 'rejected' || status.status === 'review_required') && (
            <>
              <div className="mb-6">
                <Progress value={currentStep * 25} className="mb-2" />
                <div className="text-sm text-gray-600">Step {currentStep} of 4</div>
              </div>

              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Personal Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, country: value }));
                        setSelectedCountry(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="JP">Japan</SelectItem>
                        <SelectItem value="SG">Singapore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Address Information
                  </h3>
                  
                  <div>
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={formData.address.street}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, street: e.target.value }
                      }))}
                      placeholder="123 Main St"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.address.city}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, city: e.target.value }
                        }))}
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        value={formData.address.state}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, state: e.target.value }
                        }))}
                        placeholder="NY"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="postalCode">Postal/ZIP Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.address.postalCode}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, postalCode: e.target.value }
                      }))}
                      placeholder="10001"
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Document Upload
                  </h3>
                  
                  {requirements?.requirements && (
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Required Documents for {formData.country}:</strong>
                        <ul className="mt-2 list-disc list-inside">
                          {requirements.requirements.documents.map((doc, index) => (
                            <li key={index}>{doc.replace('_', ' ').toUpperCase()}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {['passport', 'drivers_license', 'national_id', 'utility_bill'].map((docType) => (
                      <div key={docType} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Camera className="w-4 h-4" />
                          <span className="font-medium">
                            {docType.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(docType, file);
                          }}
                          className="w-full"
                        />
                        {selectedFiles[docType] && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {selectedFiles[docType].name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Review & Submit
                  </h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div><strong>Name:</strong> {formData.firstName} {formData.lastName}</div>
                    <div><strong>Date of Birth:</strong> {formData.dateOfBirth}</div>
                    <div><strong>Country:</strong> {formData.country}</div>
                    <div><strong>Phone:</strong> {formData.phoneNumber || 'Not provided'}</div>
                    <div><strong>Address:</strong> {formData.address.street}, {formData.address.city}, {formData.address.state} {formData.address.postalCode}</div>
                    <div><strong>Documents:</strong> {Object.keys(selectedFiles).length} uploaded</div>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      By submitting this information, you confirm that all details are accurate and you consent to identity verification processing.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                >
                  Previous
                </Button>
                
                {currentStep < 4 ? (
                  <Button onClick={() => setCurrentStep(currentStep + 1)}>
                    Next
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit} 
                    disabled={submitKYC.isPending}
                  >
                    {submitKYC.isPending ? 'Submitting...' : 'Submit Verification'}
                  </Button>
                )}
              </div>
            </>
          )}

          {status?.status === 'approved' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Verification Complete!</strong> Your identity has been verified and you have access to enhanced features and higher transaction limits.
              </AlertDescription>
            </Alert>
          )}

          {status?.status === 'pending' && (
            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Verification in Progress</strong> Your documents are being reviewed. This typically takes 1-3 business days.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}