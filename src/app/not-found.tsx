import React from "react";
import Link from "next/link";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        <CafeLogo size="md" showTagline={false} showPoweredBy={false} href="/" />

        <div className="p-6 rounded-2xl border border-[#242424] bg-[#171717]/80 shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#D8B58A]/10 border border-[#D8B58A]/20 text-[#D8B58A] flex items-center justify-center mx-auto">
            <Compass className="w-7 h-7" />
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold text-[#F6EFE7]">
              Page Not Found
            </h1>
            <p className="text-xs text-[#A8A29E] mt-2">
              The page or resource you are looking for does not exist or has been moved.
            </p>
          </div>

          <Link href="/" className="block pt-2">
            <Button
              variant="primary"
              className="w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Velvet Bloom Café</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

