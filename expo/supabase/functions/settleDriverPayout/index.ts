// Settle Driver Payout Edge Function
// Generates settlement batches and exports for driver bank transfers

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createServiceClient, getUserFromToken, generateReference } from "../_shared/supabase.ts";
import { decryptBankDetails, encrypt } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SettlementRequest {
  period: "daily" | "weekly";
  driver_id?: string; // Optional: settle specific driver
  dry_run?: boolean; // If true, don't actually create settlements
}

interface SettlementResponse {
  success: boolean;
  batch_id?: string;
  settlement_count?: number;
  total_amount?: number;
  csv_data?: string;
  settlements?: Array<{
    driver_id: string;
    driver_name: string;
    amount: number;
    transaction_count: number;
  }>;
  message?: string;
  error?: string;
}

interface DriverSettlement {
  driver_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  gross_amount: number;
  transaction_count: number;
  bank_details?: {
    bank_name: string;
    account_number: string;
    account_holder_name: string;
    branch_code: string;
    country: string;
    currency: string;
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from token and verify admin role
    const user = await getUserFromToken(authHeader);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: SettlementRequest = await req.json();
    const { period = "daily", driver_id, dry_run = false } = body;

    const serviceClient = createServiceClient();

    // Calculate period dates
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = new Date(now);
    
    if (period === "daily") {
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      periodStart.setDate(periodStart.getDate() - 1); // Yesterday
      periodEnd.setHours(0, 0, 0, 0); // End of yesterday
    } else {
      // Weekly: last 7 days
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      periodStart.setDate(periodStart.getDate() - 7);
      periodEnd.setHours(0, 0, 0, 0);
    }

    // Build query for drivers with pending balances
    let query = serviceClient
      .from("drivers")
      .select(`
        id,
        user_id,
        users!inner(
          id,
          first_name,
          last_name,
          phone
        ),
        driver_bank_details(
          bank_name_encrypted,
          account_number_encrypted,
          account_holder_name_encrypted,
          branch_code_encrypted,
          country,
          currency,
          is_verified
        )
      `);

    if (driver_id) {
      query = query.eq("id", driver_id);
    }

    const { data: drivers, error: driversError } = await query;

    if (driversError) {
      console.error("Failed to fetch drivers:", driversError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch drivers" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!drivers || drivers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No drivers found for settlement" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending balances for each driver
    const settlements: DriverSettlement[] = [];
    const minPayoutAmount = Number(Deno.env.get("MIN_PAYOUT_AMOUNT") || "10.00");
    const feePercentage = Number(Deno.env.get("SETTLEMENT_FEE_PERCENTAGE") || "2.5") / 100;

    for (const driver of drivers) {
      // Get wallet pending balance
      const { data: wallet } = await serviceClient
        .from("wallets")
        .select("pending_balance")
        .eq("user_id", driver.user_id)
        .single();

      const pendingBalance = Number(wallet?.pending_balance || 0);

      if (pendingBalance < minPayoutAmount) {
        continue; // Skip if below minimum
      }

      // Count transactions in period
      const { count: txnCount } = await serviceClient
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("to_wallet_id", wallet?.id)
        .eq("type", "ride_payment")
        .eq("status", "completed")
        .gte("completed_at", periodStart.toISOString())
        .lt("completed_at", periodEnd.toISOString());

      // Decrypt bank details if available
      let bankDetails;
      const bankDetailsRecord = (driver.driver_bank_details as any)?.[0];
      
      if (bankDetailsRecord && bankDetailsRecord.is_verified) {
        try {
          bankDetails = await decryptBankDetails({
            bank_name_encrypted: bankDetailsRecord.bank_name_encrypted,
            account_number_encrypted: bankDetailsRecord.account_number_encrypted,
            account_holder_name_encrypted: bankDetailsRecord.account_holder_name_encrypted,
            branch_code_encrypted: bankDetailsRecord.branch_code_encrypted,
          });
          bankDetails.country = bankDetailsRecord.country;
          bankDetails.currency = bankDetailsRecord.currency;
        } catch (decryptError) {
          console.error(`Failed to decrypt bank details for driver ${driver.id}:`, decryptError);
        }
      }

      settlements.push({
        driver_id: driver.id,
        user_id: driver.user_id,
        first_name: (driver.users as any).first_name || "",
        last_name: (driver.users as any).last_name || "",
        phone: (driver.users as any).phone,
        gross_amount: pendingBalance,
        transaction_count: txnCount || 0,
        bank_details: bankDetails,
      });
    }

    if (settlements.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No drivers with balance above minimum (${minPayoutAmount})` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate batch ID
    const batchId = generateReference("BATCH");

    // Calculate totals
    const totalGrossAmount = settlements.reduce((sum, s) => sum + s.gross_amount, 0);
    const totalFees = Number((totalGrossAmount * feePercentage).toFixed(2));
    const totalNetAmount = totalGrossAmount - totalFees;

    // Generate CSV export
    const csvHeaders = [
      "Driver ID",
      "Driver Name",
      "Phone",
      "Gross Amount",
      "Fee",
      "Net Amount",
      "Transaction Count",
      "Bank Name",
      "Account Number",
      "Account Holder",
      "Branch Code",
      "Currency",
    ];

    const csvRows = settlements.map((s) => {
      const fee = Number((s.gross_amount * feePercentage).toFixed(2));
      const netAmount = s.gross_amount - fee;
      
      return [
        s.driver_id,
        `${s.first_name} ${s.last_name}`.trim(),
        s.phone,
        s.gross_amount.toFixed(2),
        fee.toFixed(2),
        netAmount.toFixed(2),
        s.transaction_count.toString(),
        s.bank_details?.bank_name || "N/A",
        s.bank_details?.account_number || "N/A",
        s.bank_details?.account_holder_name || "N/A",
        s.bank_details?.branch_code || "N/A",
        s.bank_details?.currency || "USD",
      ];
    });

    const csvData = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      "",
      `"Total Gross","${totalGrossAmount.toFixed(2)}"`,
      `"Total Fees","${totalFees.toFixed(2)}"`,
      `"Total Net","${totalNetAmount.toFixed(2)}"`,
      `"Settlement Count","${settlements.length}"`,
      `"Batch ID","${batchId}"`,
      `"Generated At","${now.toISOString()}"`,
    ].join("\n");

    // If not a dry run, create settlement records
    if (!dry_run) {
      const settlementRecords = [];

      for (const s of settlements) {
        const fee = Number((s.gross_amount * feePercentage).toFixed(2));
        
        // Encrypt bank details snapshot
        let bankDetailsSnapshot = null;
        if (s.bank_details) {
          bankDetailsSnapshot = await encrypt(JSON.stringify(s.bank_details));
        }

        const settlementRecord = {
          driver_id: s.driver_id,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          gross_amount: s.gross_amount,
          fees: fee,
          currency: s.bank_details?.currency || "USD",
          status: "pending" as const,
          batch_id: batchId,
          bank_details_snapshot: bankDetailsSnapshot,
          transaction_count: s.transaction_count,
          export_generated_at: now.toISOString(),
        };

        settlementRecords.push(settlementRecord);
      }

      // Insert settlement records
      const { error: insertError } = await serviceClient
        .from("settlements")
        .insert(settlementRecords);

      if (insertError) {
        console.error("Failed to create settlement records:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create settlement records" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reset pending balances
      for (const s of settlements) {
        await serviceClient
          .from("wallets")
          .update({ pending_balance: 0 })
          .eq("user_id", s.user_id);
      }

      // Log to audit
      await serviceClient
        .from("audit_log")
        .insert({
          user_id: user.id,
          action: "settlement_batch_created",
          table_name: "settlements",
          new_values: {
            batch_id: batchId,
            settlement_count: settlements.length,
            total_amount: totalGrossAmount,
            period: period,
          },
        });
    }

    const response: SettlementResponse = {
      success: true,
      batch_id: batchId,
      settlement_count: settlements.length,
      total_amount: totalNetAmount,
      csv_data: csvData,
      settlements: settlements.map((s) => ({
        driver_id: s.driver_id,
        driver_name: `${s.first_name} ${s.last_name}`.trim(),
        amount: s.gross_amount - Number((s.gross_amount * feePercentage).toFixed(2)),
        transaction_count: s.transaction_count,
      })),
      message: dry_run 
        ? "Dry run completed. No settlements created." 
        : `Created ${settlements.length} settlement records`,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Settlement error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



