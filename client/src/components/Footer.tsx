import { Building2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>© {new Date().getFullYear()} </span>
            <a 
              href="https://kelloggholdings.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Kellogg Holdings LLC
            </a>
            <span>. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}