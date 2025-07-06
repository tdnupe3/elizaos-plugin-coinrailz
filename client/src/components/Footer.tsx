import { Building2 } from "@/lib/icons";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex flex-col items-center space-y-3">
            {/* Legal Links */}
            <div className="flex flex-wrap items-center justify-center space-x-6 text-sm">
              <Link href="/docs" className="text-gray-600 hover:text-gray-900 hover:underline">
                Platform Guide
              </Link>
              <Link href="/legal-disclaimers" className="text-gray-600 hover:text-gray-900 hover:underline">
                Legal Disclaimers
              </Link>
              <Link href="/contact-us" className="text-gray-600 hover:text-gray-900 hover:underline">
                Contact Us
              </Link>
              <a 
                href="mailto:support@coinrailz.com" 
                className="text-gray-600 hover:text-gray-900 hover:underline"
              >
                Support
              </a>
            </div>

            {/* Copyright */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
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
      </div>
    </footer>
  );
}