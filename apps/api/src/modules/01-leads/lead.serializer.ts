
/**
 * TODO(Q03): DTO tạm thời.
 * Chờ BA chốt danh sách trường được phép hiển thị.
 */

type LeadForAnonymization = {
  id: number;
  leadCode: string;
  contactChannel: string | null;
  sourceWebsite: string | null;
  pipelineStatus: string;
  lostReason: string | null;
  assignedSalesId: number | null;
  createdAt: Date;
  leadProducts: {
    productId: number;
    product: {
      productName: string;
    };
  }[];
};

export function anonymizeLeadList<T extends LeadForAnonymization>(
  leads: T[]
) {
  return leads.map((lead) => ({
    id: lead.id,
    leadCode: lead.leadCode,
    contactChannel: lead.contactChannel,
    // TODO(Q03): Chờ BA xác nhận trường được phép hiển thị.
    sourceWebsite: null,
    pipelineStatus: lead.pipelineStatus,
    // TODO(Q03): Chờ BA xác nhận cách hiển thị lý do mất Lead.
    lostReason: null, 
    assignedSalesId: lead.assignedSalesId,
    createdAt: lead.createdAt,
  leadProducts: lead.leadProducts.map((item) => ({
    productId: item.productId,
    // TODO(Q03): Chờ BA xác nhận quyền hiển thị tên sản phẩm.
    productName: null,
  })),
  }));
}

export function anonymizeLeadDetail<
  T extends Parameters<typeof anonymizeLeadList>[0][number]
>(lead: T) {
  return anonymizeLeadList([lead])[0];
}
