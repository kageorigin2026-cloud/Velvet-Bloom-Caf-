"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { CafeTable, CafeSettings } from "@/types/database.types";
import {
  Printer,
  Download,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  QrCode as QrIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QrStandeeBatchViewProps {
  tables: CafeTable[];
  settings: CafeSettings;
  baseUrl: string;
}

export function QrStandeeBatchView({ tables, settings, baseUrl }: QrStandeeBatchViewProps) {
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [isLoadingQrs, setIsLoadingQrs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [printSingleId, setPrintSingleId] = useState<string | null>(null);

  // Normalize baseUrl to eliminate trailing slash
  // Normalize baseUrl and enforce production origin safety check
  const cleanBaseUrl = useMemo(() => {
    let resolved = (baseUrl || "").trim().replace(/\/+$/, "");
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname.toLowerCase();
      const isProdHost = hostname.includes("vercel.app") || hostname.includes("velvet-bloom");
      if (isProdHost && (resolved.includes("localhost") || resolved.includes("127.0.0.1") || !resolved)) {
        resolved = window.location.origin;
      }
    }
    return resolved || "https://velvet-bloom-caf.vercel.app";
  }, [baseUrl]);

  // Generate sharp, high-contrast QR codes for each table record
  useEffect(() => {
    let isMounted = true;

    async function generateAllQrs() {
      setIsLoadingQrs(true);
      const urls: Record<string, string> = {};

      for (const table of tables) {
        if (!table.qr_code_token) continue;
        const targetUrl = `${cleanBaseUrl}/table/${table.qr_code_token}`;
        try {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            width: 360,
            margin: 1,
            color: {
              dark: "#080808",
              light: "#FFFFFF",
            },
            errorCorrectionLevel: "H",
          });
          urls[table.id] = dataUrl;
        } catch (err) {
          console.error(`Failed to generate QR for ${table.table_number}:`, err);
        }
      }

      if (isMounted) {
        setQrCodeUrls(urls);
        setIsLoadingQrs(false);
      }
    }

    generateAllQrs();
    return () => {
      isMounted = false;
    };
  }, [tables, cleanBaseUrl]);

  // Handle single standee print
  const handlePrintSingle = (tableId: string) => {
    setPrintSingleId(tableId);
    setTimeout(() => {
      window.print();
      setPrintSingleId(null);
    }, 150);
  };

  // Download individual QR code as PNG image
  const handleDownloadQr = (table: CafeTable) => {
    const dataUrl = qrCodeUrls[table.id];
    if (!dataUrl) return;

    const slug = table.table_number.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `velvet-bloom-${slug}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter tables
  const filteredTables = tables.filter((table) => {
    const matchesSearch =
      table.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.qr_code_token.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || table.status === statusFilter;

    let matchesZone = true;
    if (zoneFilter === "TERRACE") {
      matchesZone = table.table_number.toLowerCase().includes("terrace");
    } else if (zoneFilter === "VIP") {
      matchesZone = table.table_number.toLowerCase().includes("vip");
    } else if (zoneFilter === "MAIN") {
      matchesZone =
        !table.table_number.toLowerCase().includes("terrace") &&
        !table.table_number.toLowerCase().includes("vip");
    }

    return matchesSearch && matchesStatus && matchesZone;
  });

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* 1. TOP HEADER & CONTROLS (Hidden during print) */}
      <div className="no-print space-y-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#242424]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-xs text-[#A8A29E] hover:text-[#D8B58A] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </Link>
              <span className="text-xs text-[#555]">•</span>
              <span className="text-xs text-[#D8B58A] font-semibold">Printable Assets</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#F6EFE7] tracking-tight">
              Velvet Bloom Café — QR Standee Batch
            </h1>
            <p className="text-xs sm:text-sm text-[#A8A29E]">
              Printable Master Table Sheet ({tables.length} Production Tables) · A4 Ready
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Refresh</span>
            </Button>

            <button
              onClick={() => {
                setPrintSingleId(null);
                window.print();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D8B58A] via-[#E2C9A6] to-[#C99A8A] text-[#080808] font-bold text-xs sm:text-sm shadow-xl shadow-black/60 hover:opacity-95 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Standees</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by table name or token (e.g. Terrace, Table 5, vb_tbl_...)"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-[#080808] p-1 border border-[#242424] text-xs">
              <button
                onClick={() => setZoneFilter("ALL")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  zoneFilter === "ALL" ? "bg-[#242424] text-[#D8B58A]" : "text-[#A8A29E]"
                }`}
              >
                All Zones
              </button>
              <button
                onClick={() => setZoneFilter("MAIN")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  zoneFilter === "MAIN" ? "bg-[#242424] text-[#D8B58A]" : "text-[#A8A29E]"
                }`}
              >
                Main Floor
              </button>
              <button
                onClick={() => setZoneFilter("TERRACE")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  zoneFilter === "TERRACE" ? "bg-[#242424] text-[#D8B58A]" : "text-[#A8A29E]"
                }`}
              >
                Terrace
              </button>
              <button
                onClick={() => setZoneFilter("VIP")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  zoneFilter === "VIP" ? "bg-[#242424] text-[#D8B58A]" : "text-[#A8A29E]"
                }`}
              >
                VIP
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
            >
              <option value="ALL">All Table Statuses</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="OCCUPIED">Occupied Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. LOADING STATE */}
      {isLoadingQrs && (
        <div className="no-print p-12 text-center rounded-3xl bg-[#171717] border border-[#242424]">
          <RefreshCw className="w-6 h-6 text-[#D8B58A] animate-spin mx-auto mb-3" />
          <h3 className="font-serif font-bold text-base text-[#F6EFE7]">
            Generating High-Contrast Table QR Codes...
          </h3>
          <p className="text-xs text-[#A8A29E] mt-1">
            Validating physical tokens against Supabase V2 records
          </p>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!isLoadingQrs && filteredTables.length === 0 && (
        <div className="no-print p-12 text-center rounded-3xl bg-[#171717] border border-[#242424]">
          <QrIcon className="w-8 h-8 text-[#A8A29E] mx-auto mb-3" />
          <h3 className="font-serif font-bold text-base text-[#F6EFE7]">
            No matching tables found
          </h3>
          <p className="text-xs text-[#A8A29E] mt-1">
            Try adjusting your search criteria or filter options
          </p>
        </div>
      )}

      {/* 4. THE STANDEE BATCH GRID (Designed for Screen & Print) */}
      {!isLoadingQrs && filteredTables.length > 0 && (
        <div className="standee-grid-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print-grid">
            {filteredTables.map((table) => {
              const isHiddenInSinglePrint =
                printSingleId !== null && printSingleId !== table.id;

              if (isHiddenInSinglePrint) return null;

              const qrUrl = `${cleanBaseUrl}/table/${table.qr_code_token}`;
              const dataUrl = qrCodeUrls[table.id];

              return (
                <div
                  key={table.id}
                  className="table-standee-card group relative p-6 rounded-3xl bg-[#171717] border-[1.5px] border-[#D8B58A] text-center flex flex-col items-center justify-between shadow-2xl transition-all duration-300 hover:shadow-[#D8B58A]/10 hover:border-[#F6EFE7]/80"
                >
                  {/* Standee Header: Cafe Name & Tagline */}
                  <div className="w-full mb-3">
                    <h3 className="font-serif text-lg font-bold tracking-wider text-[#F6EFE7] uppercase">
                      {settings.cafe_name || "VELVET BLOOM CAFÉ"}
                    </h3>
                    <p className="font-serif italic text-xs text-[#D8B58A] tracking-wide mt-0.5">
                      {settings.tagline || "Sip. Savor. Bloom."}
                    </p>
                  </div>

                  {/* Table Name Badge */}
                  <div className="mb-3.5">
                    <span className="inline-block px-4 py-1 rounded-full bg-[#D8B58A] text-[#080808] font-bold text-xs sm:text-sm tracking-wide shadow-md">
                      {table.table_number}
                    </span>
                  </div>

                  {/* High-Contrast Scannable QR Code Box */}
                  <div className="w-full flex justify-center mb-3">
                    <div className="p-3 rounded-2xl bg-white shadow-xl inline-block border-2 border-white">
                      {dataUrl ? (
                        <img
                          src={dataUrl}
                          alt={`QR Code for ${table.table_number}`}
                          className="w-36 h-36 sm:w-40 sm:h-40 block mx-auto object-contain"
                        />
                      ) : (
                        <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-mono">
                          Generating QR...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scan Instructions & Token Details */}
                  <div className="w-full mb-3 space-y-0.5">
                    <p className="text-xs font-semibold text-[#F6EFE7] tracking-wide">
                      Scan with Camera to Order
                    </p>
                    <p className="text-[10px] text-[#A8A29E] font-mono tracking-tight">
                      Token: {table.qr_code_token} · Seats {table.capacity}
                    </p>
                  </div>

                  {/* Standee Footer Branding */}
                  <div className="w-full pt-2.5 border-t border-[#242424] flex items-center justify-between text-[9px] uppercase tracking-widest text-[#A8A29E]/80">
                    <span className="font-medium">
                      Status:{" "}
                      <span
                        className={
                          table.status === "AVAILABLE" ? "text-[#6FAF82]" : "text-[#D8B58A]"
                        }
                      >
                        {table.status}
                      </span>
                    </span>
                    <span className="font-bold text-[#D8B58A]/90">Powered by Kage Origin</span>
                  </div>

                  {/* Web-Only Card Action Bar (Hover Overlay & Quick Buttons, Hidden in Print) */}
                  <div className="no-print mt-4 pt-3 border-t border-[#242424] w-full grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => handleDownloadQr(table)}
                      className="py-1.5 px-2 rounded-lg bg-[#080808] border border-[#242424] text-[#A8A29E] hover:text-[#D8B58A] hover:border-[#D8B58A]/50 transition-colors flex items-center justify-center gap-1 text-[11px]"
                      title="Download PNG QR image"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG</span>
                    </button>

                    <button
                      onClick={() => handlePrintSingle(table.id)}
                      className="py-1.5 px-2 rounded-lg bg-[#080808] border border-[#242424] text-[#A8A29E] hover:text-[#F6EFE7] hover:border-[#C99A8A]/50 transition-colors flex items-center justify-center gap-1 text-[11px]"
                      title="Print just this standee"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Print</span>
                    </button>

                    <Link
                      href={`/table/${table.qr_code_token}`}
                      target="_blank"
                      className="py-1.5 px-2 rounded-lg bg-[#080808] border border-[#242424] text-[#A8A29E] hover:text-[#D8B58A] hover:border-[#D8B58A]/50 transition-colors flex items-center justify-center gap-1 text-[11px]"
                      title="Open live customer view in new tab"
                    >
                      <span>Test</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. DEDICATED PRINT STYLESHEET */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          body {
            background: #ffffff !important;
            color: #080808 !important;
            padding: 0 !important;
          }

          .no-print {
            display: none !important;
          }

          .standee-grid-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8mm !important;
          }

          .table-standee-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #171717 !important;
            color: #f6efe7 !important;
            border: 2px solid #d8b58a !important;
            border-radius: 18px !important;
            padding: 20px 16px !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .table-standee-card h3 {
            color: #f6efe7 !important;
            -webkit-print-color-adjust: exact !important;
          }

          .table-standee-card p {
            color: #d8b58a !important;
            -webkit-print-color-adjust: exact !important;
          }

          .table-standee-card span {
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>
    </main>
  );
}
