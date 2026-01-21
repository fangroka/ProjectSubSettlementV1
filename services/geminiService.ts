
import { GoogleGenAI } from "@google/genai";

export const analyzeSettlementRisk = async (data: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      作为高级建筑项目财务审计师，请对以下项目分包结算表单进行风险与逻辑审计：
      
      【登记与项目信息】: ${JSON.stringify(data.project)}
      【分包合同状态】: ${JSON.stringify(data.subcontract)}
      【本次测算明细】: ${JSON.stringify(data.settlement)}

      核心审计逻辑：
      本次应付金额 = 本期结算金额 - (增值税 + 附加税 + 签字费 + 固定扣除项) + 进项抵扣额。
      当前结果：${data.settlement.netPayable} 元。

      请重点分析：
      1. 结算金额 (${data.settlement.settlementAmount}) 是否在项目可用金额 (${data.project.availableFunds}) 的安全边际内。
      2. 各类扣除项（尤其是分公司加盟管理费 ${data.settlement.fixedDeductions?.annualManagementFee}）是否符合常规比例。
      3. 进项抵扣与关联发票的税务合规建议。
      4. 结合分包未结算余额 (${data.subcontract.unsettledAmount}) 分析本次结算后的支付进度风险。

      请用中文提供专业、简洁且具备管理层决策参考价值的审计结论。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "系统忙，暂无法完成AI风险评估，请稍后再试。";
  }
};
