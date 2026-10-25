import React from "react";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { QrStandeeBatchView } from "./QrStandeeBatchView";

export const metadata = {
  title: "QR Standee Batch Generator | Velvet Bloom Café Admin",
  description: "Print-ready luxury table standees with high-contrast QR codes for Velvet Bloom Café.",
};

export default async function AdminQrCodesPage() {
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const [tables, settings] = await Promise.all([
    adapter.getTables(tenantId),
    adapter.getSettings(tenantId),
  ]);

  // Sort tables in natural numerical order (Table 1, Table 2, ... Table 12)
  const sortedTables = [...tables].sort((a, b) => {
    const numA = parseInt(a.table_number.replace(/\D/g, "") || "0", 10);
    const numB = parseInt(b.table_number.replace(/\D/g, "") || "0", 10);
    return numA - numB;
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://velvet-bloom-caf.vercel.app";

  return (
    <NotificationProvider role="ADMIN">
      <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col">
        <div className="no-print">
          <StaffHeader currentRole="OWNER" staffName="Alexander Vance" />
          <NotificationBanner />
        </div>
        <QrStandeeBatchView
          tables={sortedTables}
          settings={settings}
          baseUrl={baseUrl}
        />
      </div>
    </NotificationProvider>
  );
}
