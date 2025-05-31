import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Footer } from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactUs() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ContactForm>({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      return await apiRequest("POST", "/api/contact", data);
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Thank you for contacting us. We'll respond within 24 hours.",
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again or email us directly.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof ContactForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
            <p className="text-gray-600">Get in touch with our support team</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you within 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => handleInputChange("subject", e.target.value)}
                      placeholder="Brief description of your inquiry"
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      placeholder="Please describe your question or issue in detail..."
                      rows={6}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>
                    Other ways to reach our support team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">Email Support</p>
                      <a 
                        href="mailto:support@coinrailz.com" 
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        support@coinrailz.com
                      </a>
                      <p className="text-sm text-gray-500">General support and inquiries</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Phone className="w-5 h-5 text-green-600 mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">Compliance Officer</p>
                      <a 
                        href="tel:205-202-1093" 
                        className="text-green-600 hover:text-green-800 hover:underline"
                      >
                        205-202-1093
                      </a>
                      <p className="text-sm text-gray-500">Travis Kellogg - AML/KYC inquiries</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 text-purple-600 mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">Compliance Email</p>
                      <a 
                        href="mailto:travis@kelloggholdings.com" 
                        className="text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        travis@kelloggholdings.com
                      </a>
                      <p className="text-sm text-gray-500">AML/KYC compliance matters</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-orange-600 mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">Response Time</p>
                      <p className="text-gray-700">Within 24 hours</p>
                      <p className="text-sm text-gray-500">Monday - Friday, business hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">Kellogg Holdings LLC</p>
                    <p className="text-gray-600">Licensed Money Transmitter - Alabama</p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Operating Hours:</strong><br />
                      Monday - Friday: 9:00 AM - 6:00 PM CST<br />
                      Emergency compliance matters: 24/7
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-yellow-800">
                    <strong>Security Notice:</strong> Never share your login credentials, 
                    PINs, or sensitive financial information via email or phone. Our team 
                    will never ask for this information.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}