
export interface RegistrationInfo {
  department: string;
  user: string;
  date: string;
}

export interface ProjectFinancials {
  projectName: string;
  projectNo: string;
  projectBelonging: string;
  totalAmount: number;
  invoicedAmount: number;
  receivedAmount: number;
  accumulatedSubSettlement: number;
  availableFunds: number;
}

export type CooperationMode = '加盟' | '自营' | '单项目合作';

export interface SubcontractInfo {
  contractName: string;
  contractNo: string;
  vendorName: string;
  cooperationMode: CooperationMode;
  contractAmount: number;
  accumulatedInvoicing: number;
  accumulatedSettlement: number;
  paidAmount: number;
  unsettledAmount: number;
}

export interface DeductionItem {
  id: string;
  label: string;
  type: 'rate' | 'fixed';
  value: number; // 如果是 rate，则为 0.06 这种；如果是 fixed，则为金额
  isActive: boolean;
  isCustom?: boolean;
}

export interface CurrentSettlement {
  settlementNo: string;
  projectSettlableAmount: number;
  settlementAmount: number;
  deductions: DeductionItem[];
}

export interface TimelineEvent {
  id: string;
  status: 'Draft' | 'Reviewing' | 'Auditing' | 'Approved' | 'Completed';
  user: string;
  role: string;
  time: string;
  comment?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}
