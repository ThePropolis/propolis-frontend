const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface DoorloopProfitLossResponse {
  success: boolean;
  data: {
    columns: Array<{ title: string; field: string; cellFormatType?: string }>;
    data: Array<{
      id: string;
      type: string;
      typeId: string;
      name?: string;
      total?: number;
      totalWithSubAccounts?: number;
      absTotalWithSubAccounts?: number;
    }>;
  };
  parameters_used: { filter_accountingMethod: string };
}

export interface JurnyShortTermKPIsResponse {
  revenue: string;
  occupancy: number;
  adr: string;
  revpar: string;
}

export async function getDoorloopProfitLoss(
  accountingMethod: string = 'cash',
  startDate?: string,
  endDate?: string,
  propertyId?: string
): Promise<DoorloopProfitLossResponse> {
  const url = new URL(`${API_URL}/api/doorloop/profit-and-loss`);
  url.searchParams.append('accounting_method', accountingMethod);
  if (startDate) url.searchParams.append('start_date', startDate);
  if (endDate) url.searchParams.append('end_date', endDate);
  if (propertyId) url.searchParams.append('property_id', propertyId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch Doorloop profit and loss: ${res.statusText}`);
  return res.json();
}

export async function getJurnyShortTermKPIs(
  startDate: string,
  endDate: string,
  propertyName?: string
): Promise<JurnyShortTermKPIsResponse> {
  const url = new URL(`${API_URL}/api/jurny/short-term-kpis`);
  url.searchParams.append('date_start', startDate);
  url.searchParams.append('date_to', endDate);
  if (propertyName) url.searchParams.append('property_name', propertyName);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch Jurny short-term KPIs: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

export function extractLongTermRevenue(
  profitLossData: DoorloopProfitLossResponse | null | undefined
): number {
  if (!profitLossData?.data?.data) return 0;
  const incomeEntry = profitLossData.data.data.find(
    (item) => item.typeId === 'INCOME' && item.type === 'category'
  );
  return incomeEntry?.totalWithSubAccounts || 0;
}
