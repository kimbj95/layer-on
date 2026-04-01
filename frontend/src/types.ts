export interface LayerInfo {
  original_name: string;
  code: string;
  name: string;
  category_major: string;
  category_major_name: string;
  category_mid: string;
  default_color: string;
  official_color: string;
  current_color: string;
  linetype: string;
  structure: string;
  is_mapped: boolean;
  original_aci_color: number;
}

export interface CategoryGroup {
  category_major: string;
  category_major_name: string;
  count: number;
  layers: LayerInfo[];
}

export interface SessionState {
  session_id: string;
  file_name: string;
  file_size_mb: number;
  created_at: string;
  total_layers: number;
  mapped_count: number;
  categories: CategoryGroup[];
  unmapped_layers: LayerInfo[];
  has_output?: boolean;
  output_filename?: string;
}
