import { Shield, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function PatentDisclaimer() {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-800 font-medium mb-1">Patent Protected Technology</p>
            <p className="text-blue-700 leading-relaxed">
              The P2P interoperability platform and AI agent marketplace with integrated financial 
              services infrastructure are protected by patent. Additional patents filed. 
              Unauthorized use, reproduction, or distribution of this technology is prohibited.
            </p>
            <p className="text-blue-600 text-xs mt-2">
              © 2025 Kellogg Holdings LLC. All rights reserved.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PatentFooterNotice() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 mt-4">
      <FileText className="w-3 h-3" />
      <span>Patent Pending: U.S. Application #63/820,228</span>
    </div>
  );
}