import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function SecurityBanner() {
  return (
    <Card className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
      <CardContent className="p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Your money is secure</h3>
              <p className="text-blue-100">Bank-level encryption and fraud protection</p>
            </div>
          </div>
          <Button 
            variant="secondary"
            className="bg-white/20 text-white hover:bg-white/30 border-0"
          >
            Learn More
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
