/**
 * 家长「切换门店」扁平门店项（对齐 GET /auth/parent-storefronts）
 */
export interface ParentStorefrontStudent {
  id: string;
  name: string;
}

export interface ParentStorefrontItem {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  campusId: string;
  campusName: string;
  isMain: boolean;
  students: ParentStorefrontStudent[];
}

export interface ParentStorefrontsResult {
  list: ParentStorefrontItem[];
  current: { organizationId?: string; campusId?: string } | null;
}
