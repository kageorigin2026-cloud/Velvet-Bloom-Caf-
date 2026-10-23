import React from "react";
import { PaymentConfirmationView } from "./PaymentConfirmationView";

interface PageProps {
  searchParams: Promise<{
    orderNumber?: string;
    billNumber?: string;
    amount?: string;
    method?: string;
    table?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function PaymentConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const parsedAmount = params.amount ? parseFloat(params.amount) : 0;

  return (
    <PaymentConfirmationView
      orderNumber={params.orderNumber || "VB-20261023-0001"}
      billNumber={params.billNumber || "BILL-0001"}
      amount={isNaN(parsedAmount) ? 0 : parsedAmount}
      paymentMethod={params.method || "ONLINE"}
      tableNumber={params.table || "Table"}
    />
  );
}

